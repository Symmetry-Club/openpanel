/**
 * Pure helpers that turn a `chart.sql` result (columns + array rows) into the
 * shapes each SQL visualization draws. Kept free of React and app imports so
 * they can be unit tested on their own.
 */

export interface SqlResultColumn {
  name: string;
  type: string;
}

export interface SqlResultLike {
  columns: SqlResultColumn[];
  rows: unknown[][];
}

export type SqlColumnKind = 'number' | 'date' | 'text';

export interface SqlSeries {
  /** Safe recharts dataKey (column names may contain dots). */
  key: string;
  name: string;
}

export interface SqlSeriesData {
  xKind: SqlColumnKind;
  series: SqlSeries[];
  /** One entry per X value: `{ x, [series.key]: number | null }`. */
  data: Record<string, unknown>[];
}

export const SQL_X_KEY = 'x';
/** More lines/bars than this are unreadable; the biggest series win. */
export const SQL_MAX_SERIES = 20;

const TYPE_WRAPPER_REGEX = /^(Nullable|LowCardinality)\((.*)\)$/;
const NUMBER_TYPE_REGEX = /^(U?Int\d+|Float\d+|Decimal)/;
const DATE_TYPE_REGEX = /^(Date|DateTime)/;

function unwrapType(type: string): string {
  let current = type;
  let match = current.match(TYPE_WRAPPER_REGEX);
  while (match) {
    current = match[2]!;
    match = current.match(TYPE_WRAPPER_REGEX);
  }
  return current;
}

export function getSqlColumnKind(type: string): SqlColumnKind {
  const inner = unwrapType(type);
  if (NUMBER_TYPE_REGEX.test(inner)) {
    return 'number';
  }
  if (DATE_TYPE_REGEX.test(inner)) {
    return 'date';
  }
  return 'text';
}

export function toSqlNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sqlValueToLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function keepBiggestSeries(
  series: SqlSeries[],
  data: Record<string, unknown>[],
): SqlSeries[] {
  if (series.length <= SQL_MAX_SERIES) {
    return series;
  }
  const totals = new Map<string, number>();
  for (const item of data) {
    for (const { key } of series) {
      const value = toSqlNumber(item[key]) ?? 0;
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(value));
    }
  }
  const kept = new Set(
    [...series]
      .sort((a, b) => (totals.get(b.key) ?? 0) - (totals.get(a.key) ?? 0))
      .slice(0, SQL_MAX_SERIES)
      .map(({ key }) => key),
  );
  return series.filter(({ key }) => kept.has(key));
}

/**
 * Long format (`x, label, value`) → one series per distinct label. Duplicate
 * (x, label) pairs are summed; missing pairs stay `null`.
 */
function pivotLongFormat(
  rows: unknown[][],
  labelIndex: number,
  valueIndex: number,
): Pick<SqlSeriesData, 'series' | 'data'> {
  const seriesKeyByLabel = new Map<string, string>();
  const series: SqlSeries[] = [];
  const dataByX = new Map<string, Record<string, unknown>>();
  const data: Record<string, unknown>[] = [];

  for (const row of rows) {
    const label = sqlValueToLabel(row[labelIndex]);
    let key = seriesKeyByLabel.get(label);
    if (!key) {
      key = `s${series.length}`;
      seriesKeyByLabel.set(label, key);
      series.push({ key, name: label });
    }

    const xLabel = sqlValueToLabel(row[0]);
    let item = dataByX.get(xLabel);
    if (!item) {
      item = { [SQL_X_KEY]: row[0] };
      dataByX.set(xLabel, item);
      data.push(item);
    }

    const value = toSqlNumber(row[valueIndex]);
    if (value !== null) {
      const previous = toSqlNumber(item[key]);
      item[key] = (previous ?? 0) + value;
    }
  }

  for (const item of data) {
    for (const { key } of series) {
      if (!(key in item)) {
        item[key] = null;
      }
    }
  }

  return { series, data };
}

/**
 * X axis = first column. With exactly one non-numeric and one numeric column
 * besides X the rows are read as long format and pivoted (one series per
 * label); otherwise every numeric column is a series.
 */
export function toSqlSeriesData(result: SqlResultLike): SqlSeriesData | null {
  const [xColumn, ...rest] = result.columns;
  if (!xColumn) {
    return null;
  }

  const restWithIndex = rest.map((column, offset) => ({
    column,
    index: offset + 1,
    kind: getSqlColumnKind(column.type),
  }));
  const numeric = restWithIndex.filter(({ kind }) => kind === 'number');
  const nonNumeric = restWithIndex.filter(({ kind }) => kind !== 'number');

  if (numeric.length === 0) {
    return null;
  }

  const xKind = getSqlColumnKind(xColumn.type);

  if (numeric.length === 1 && nonNumeric.length === 1) {
    const pivoted = pivotLongFormat(
      result.rows,
      nonNumeric[0]!.index,
      numeric[0]!.index,
    );
    return {
      xKind,
      series: keepBiggestSeries(pivoted.series, pivoted.data),
      data: pivoted.data,
    };
  }

  const series = numeric.map(({ column }, position) => ({
    key: `s${position}`,
    name: column.name,
  }));
  const data = result.rows.map((row) => {
    const item: Record<string, unknown> = { [SQL_X_KEY]: row[0] };
    for (const [position, { index }] of numeric.entries()) {
      item[`s${position}`] = toSqlNumber(row[index]);
    }
    return item;
  });

  return { xKind, series: keepBiggestSeries(series, data), data };
}

export interface SqlPieSlice {
  name: string;
  value: number;
}

export const SQL_PIE_OTHER_LABEL = 'Other';

/**
 * Label = first column, value = first numeric column after it. Past
 * `SQL_MAX_SERIES` slices the smallest ones are folded into "Other".
 */
export function toSqlPieData(result: SqlResultLike): SqlPieSlice[] {
  const valueIndex = result.columns.findIndex(
    (column, index) => index > 0 && getSqlColumnKind(column.type) === 'number',
  );
  if (valueIndex === -1) {
    return [];
  }

  const slices: SqlPieSlice[] = [];
  for (const row of result.rows) {
    const value = toSqlNumber(row[valueIndex]);
    if (value !== null && value > 0) {
      slices.push({ name: sqlValueToLabel(row[0]), value });
    }
  }

  if (slices.length <= SQL_MAX_SERIES) {
    return slices;
  }

  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, SQL_MAX_SERIES - 1);
  let otherValue = 0;
  for (const slice of sorted.slice(SQL_MAX_SERIES - 1)) {
    otherValue += slice.value;
  }
  kept.push({ name: SQL_PIE_OTHER_LABEL, value: otherValue });
  return kept;
}

export interface SqlMetricValue {
  name: string;
  value: number;
}

/** The first numeric value of the first row. */
export function toSqlMetric(result: SqlResultLike): SqlMetricValue | null {
  const firstRow = result.rows[0];
  if (!firstRow) {
    return null;
  }
  for (const [index, column] of result.columns.entries()) {
    if (getSqlColumnKind(column.type) !== 'number') {
      continue;
    }
    const value = toSqlNumber(firstRow[index]);
    if (value !== null) {
      return { name: column.name, value };
    }
  }
  return null;
}
