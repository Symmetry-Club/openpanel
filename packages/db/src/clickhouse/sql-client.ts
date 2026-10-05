import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { createLogger } from '@openpanel/logger';
import { CLICKHOUSE_OPTIONS } from './client';
import { normalizeSqlRows } from './sql-guard';

const logger = createLogger({ name: 'clickhouse-sql' });

/**
 * Client for hand-written SQL reports. It is deliberately separate from `ch`
 * (which can write): it only exists when `CLICKHOUSE_SQL_URL` points at a
 * read-only ClickHouse user (`readonly = 2`, so per-query settings still
 * work), e.g. `https://user:pass@host:8443/posthog`.
 */
const SQL_MAX_RESULT_ROWS = 10_000;
const DEFAULT_SQL_MAX_EXECUTION_TIME_SECONDS = 120;
const DEFAULT_SQL_MAX_MEMORY_USAGE_BYTES = 8 * 1024 * 1024 * 1024;
// Leave ClickHouse time to report its own timeout before the HTTP request
// gives up, so the author sees ClickHouse's message instead of a socket error.
const REQUEST_TIMEOUT_MARGIN_MS = 15_000;
const SQL_MAX_OPEN_CONNECTIONS = 10;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const sqlMaxExecutionTimeSeconds = parsePositiveInt(
  process.env.CLICKHOUSE_SQL_MAX_EXECUTION_TIME,
  DEFAULT_SQL_MAX_EXECUTION_TIME_SECONDS,
);
const sqlMaxMemoryUsageBytes = parsePositiveInt(
  process.env.CLICKHOUSE_SQL_MAX_MEMORY_USAGE,
  DEFAULT_SQL_MAX_MEMORY_USAGE_BYTES,
);

const SQL_QUERY_SETTINGS: ClickHouseSettings = {
  max_execution_time: sqlMaxExecutionTimeSeconds,
  max_result_rows: String(SQL_MAX_RESULT_ROWS),
  result_overflow_mode: 'break',
  max_memory_usage: String(sqlMaxMemoryUsageBytes),
};

let sqlClient: ClickHouseClient | null = null;

function getSqlClient(): ClickHouseClient | null {
  if (!process.env.CLICKHOUSE_SQL_URL) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = createClient({
      url: process.env.CLICKHOUSE_SQL_URL,
      keep_alive: CLICKHOUSE_OPTIONS.keep_alive,
      log: CLICKHOUSE_OPTIONS.log,
      max_open_connections: SQL_MAX_OPEN_CONNECTIONS,
      request_timeout:
        sqlMaxExecutionTimeSeconds * 1000 + REQUEST_TIMEOUT_MARGIN_MS,
      // OpenPanel's default settings (CLICKHOUSE_SETTINGS & co.) are tuned for
      // its own cluster and may not exist on the target server, so they are
      // not inherited here. Only the per-query limits below are sent.
      clickhouse_settings: {},
    });
  }

  return sqlClient;
}

export class SqlReportsNotConfiguredError extends Error {
  constructor() {
    super('SQL reports are not configured (CLICKHOUSE_SQL_URL is missing)');
    this.name = 'SqlReportsNotConfiguredError';
  }
}

export interface SqlQueryColumn {
  name: string;
  type: string;
}

export interface SqlQueryResult {
  columns: SqlQueryColumn[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
}

interface JsonCompactResponse {
  meta?: SqlQueryColumn[];
  data: unknown[][];
  rows?: number;
}

/**
 * Run an already validated query (see `validateUserSql`) on the read-only
 * client. ClickHouse errors propagate as-is so the author can read them.
 */
export async function executeUserSql(query: string): Promise<SqlQueryResult> {
  const client = getSqlClient();
  if (!client) {
    throw new SqlReportsNotConfiguredError();
  }

  const start = Date.now();
  const response = await client.query({
    query,
    format: 'JSONCompact',
    clickhouse_settings: SQL_QUERY_SETTINGS,
  });
  const json = (await response.json()) as JsonCompactResponse;
  const elapsedMs = Date.now() - start;

  const columns = (json.meta ?? []).map(({ name, type }) => ({ name, type }));
  // `result_overflow_mode: 'break'` stops at block granularity, so ClickHouse
  // may hand back slightly more than the limit; trim to the advertised cap.
  const truncated = json.data.length >= SQL_MAX_RESULT_ROWS;
  const rows = normalizeSqlRows(
    columns,
    json.data.slice(0, SQL_MAX_RESULT_ROWS),
  );

  logger.info(
    { rows: rows.length, truncated, elapsedMs },
    'sql report query info',
  );

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
    elapsedMs,
  };
}
