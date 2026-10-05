import sqlstring from 'sqlstring';

/**
 * Guard rails for hand-written SQL reports.
 *
 * This is defence in depth only: the real barrier is the read-only ClickHouse
 * user behind `CLICKHOUSE_SQL_URL` (`readonly = 2`). These checks exist so an
 * obviously wrong statement fails fast with a readable message instead of
 * reaching ClickHouse at all.
 *
 * Out of scope: restricting a query to a single project. The SQL report
 * feature is meant for an internal, single-organization deployment, so the
 * query can read whatever the read-only user can read.
 */

const FORBIDDEN_STATEMENT_KEYWORDS = [
  'INSERT',
  'ALTER',
  'DROP',
  'CREATE',
  'TRUNCATE',
  'RENAME',
  'OPTIMIZE',
  'SYSTEM',
  'KILL',
  'GRANT',
  'REVOKE',
  'ATTACH',
  'DETACH',
  'SET',
] as const;

// A keyword used as a qualified identifier (`system.tables`, `t.$set`) is a
// read, not a statement, so a dot on either side lets it through.
const FORBIDDEN_KEYWORD_REGEX = new RegExp(
  `(?<![.\\w$])(${FORBIDDEN_STATEMENT_KEYWORDS.join('|')})\\b(?!\\s*\\.)`,
  'i',
);
const STARTS_WITH_READ_REGEX = /^(SELECT|WITH)\b/i;
const INTO_OUTFILE_REGEX = /\bINTO\s+OUTFILE\b/i;
const SETTINGS_READONLY_REGEX = /\bSETTINGS\b[\s\S]*\breadonly\b/i;
const TRAILING_SEMICOLON_REGEX = /;\s*$/;
const START_DATE_PLACEHOLDER_REGEX = /\{\{\s*startDate\s*\}\}/g;
const END_DATE_PLACEHOLDER_REGEX = /\{\{\s*endDate\s*\}\}/g;

export type SqlValidationResult =
  | {
      valid: true;
      /** The query as it should be sent: comments removed, no trailing `;`. */
      query: string;
    }
  | { valid: false; error: string };

interface ScannedSql {
  /** Comments removed, string literals and quoted identifiers kept. */
  withoutComments: string;
  /** Comments removed and every literal/quoted identifier blanked out. */
  codeOnly: string;
}

/**
 * Single pass over the query that understands comments (`--`, `/* *\/`) and
 * quoted text (`'…'`, `"…"`, `` `…` ``, with backslash and doubled-quote
 * escapes), so a `;` or `DROP` inside a string literal is never mistaken for
 * code and a `--` inside a string is never mistaken for a comment.
 */
function scanSql(sql: string): ScannedSql {
  let withoutComments = '';
  let codeOnly = '';
  let index = 0;

  while (index < sql.length) {
    const char = sql[index]!;
    const next = sql[index + 1];

    if (char === '-' && next === '-') {
      const lineEnd = sql.indexOf('\n', index);
      index = lineEnd === -1 ? sql.length : lineEnd;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = sql.indexOf('*/', index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 2;
      withoutComments += ' ';
      codeOnly += ' ';
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      let end = index + 1;
      while (end < sql.length) {
        const current = sql[end];
        if (current === '\\') {
          end += 2;
          continue;
        }
        if (current === char) {
          if (sql[end + 1] === char) {
            end += 2;
            continue;
          }
          break;
        }
        end++;
      }
      const literal = sql.slice(index, end + 1);
      withoutComments += literal;
      codeOnly += `${char}${char}`;
      index = end + 1;
      continue;
    }

    withoutComments += char;
    codeOnly += char;
    index++;
  }

  return { withoutComments, codeOnly };
}

export function validateUserSql(sql: string): SqlValidationResult {
  const { withoutComments, codeOnly } = scanSql(sql);
  const code = codeOnly.trim();

  if (code.length === 0) {
    return { valid: false, error: 'The query is empty' };
  }

  if (!STARTS_WITH_READ_REGEX.test(code)) {
    return {
      valid: false,
      error: 'Only read queries are allowed: start with SELECT or WITH',
    };
  }

  if (code.replace(TRAILING_SEMICOLON_REGEX, '').includes(';')) {
    return {
      valid: false,
      error: 'Only a single statement is allowed',
    };
  }

  if (INTO_OUTFILE_REGEX.test(code)) {
    return { valid: false, error: 'INTO OUTFILE is not allowed' };
  }

  if (SETTINGS_READONLY_REGEX.test(code)) {
    return {
      valid: false,
      error: 'Changing the readonly setting is not allowed',
    };
  }

  const forbidden = code.match(FORBIDDEN_KEYWORD_REGEX);
  if (forbidden) {
    return {
      valid: false,
      error: `${forbidden[1]!.toUpperCase()} statements are not allowed`,
    };
  }

  return {
    valid: true,
    query: withoutComments.trim().replace(TRAILING_SEMICOLON_REGEX, '').trim(),
  };
}

/**
 * Replace `{{startDate}}` / `{{endDate}}` with escaped string literals of the
 * report's resolved date range. A query without placeholders is returned
 * untouched.
 */
export function applySqlDateRange(
  sql: string,
  { startDate, endDate }: { startDate: string; endDate: string },
): string {
  return sql
    .replace(START_DATE_PLACEHOLDER_REGEX, () => sqlstring.escape(startDate))
    .replace(END_DATE_PLACEHOLDER_REGEX, () => sqlstring.escape(endDate));
}

const WIDE_INTEGER_TYPE_REGEX = /^U?Int(64|128|256)$/;
const TYPE_WRAPPER_REGEX = /^(Nullable|LowCardinality)\((.*)\)$/;

function unwrapType(type: string): string {
  let current = type;
  let match = current.match(TYPE_WRAPPER_REGEX);
  while (match) {
    current = match[2]!;
    match = current.match(TYPE_WRAPPER_REGEX);
  }
  return current;
}

/**
 * ClickHouse quotes 64-bit (and wider) integers in JSON output so they do not
 * lose precision. Charts need numbers, so convert them the same way
 * `chQueryWithMeta` does (accepting the precision loss above 2^53).
 */
export function normalizeSqlRows(
  columns: { name: string; type: string }[],
  rows: unknown[][],
): unknown[][] {
  const wideIntegerColumns = columns.map((column) =>
    WIDE_INTEGER_TYPE_REGEX.test(unwrapType(column.type)),
  );

  if (!wideIntegerColumns.some(Boolean)) {
    return rows;
  }

  return rows.map((row) =>
    row.map((value, index) =>
      wideIntegerColumns[index] && typeof value === 'string'
        ? Number(value)
        : value,
    ),
  );
}
