import { formatDate, formatDateTime } from '@/utils/date';

import { type SqlColumnKind, sqlValueToLabel, toSqlNumber } from './transform';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIDNIGHT_REGEX = /[ T]00:00:00(\.0+)?$/;
const FRACTIONAL_SECONDS_REGEX = /(\d{2}:\d{2}:\d{2})\.\d+$/;

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
});

/**
 * ClickHouse sends Date/DateTime as wall-clock strings without a zone
 * (`2026-09-05`, `2026-09-05 13:00:00.123456`). Parse them as local time so
 * the dashboard shows exactly the wall-clock time the query produced.
 */
export function parseSqlDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const iso = DATE_ONLY_REGEX.test(value)
    ? `${value}T00:00:00`
    : value.replace(' ', 'T').replace(FRACTIONAL_SECONDS_REGEX, '$1');
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSqlValue(value: unknown, kind: SqlColumnKind): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (kind === 'number') {
    const number = toSqlNumber(value);
    return number === null ? sqlValueToLabel(value) : numberFormatter.format(number);
  }

  if (kind === 'date') {
    const date = parseSqlDate(value);
    if (!date) {
      return sqlValueToLabel(value);
    }
    const isDateOnly =
      typeof value === 'string' &&
      (DATE_ONLY_REGEX.test(value) || MIDNIGHT_REGEX.test(value));
    return isDateOnly ? formatDate(date) : formatDateTime(date);
  }

  return sqlValueToLabel(value);
}
