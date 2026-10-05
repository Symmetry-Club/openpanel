import { describe, expect, it } from 'vitest';
import {
  getSqlColumnKind,
  SQL_MAX_SERIES,
  toSqlMetric,
  toSqlPieData,
  toSqlSeriesData,
} from './transform';

describe('getSqlColumnKind', () => {
  it('classifies ClickHouse types', () => {
    expect(getSqlColumnKind('UInt64')).toBe('number');
    expect(getSqlColumnKind('Nullable(Float64)')).toBe('number');
    expect(getSqlColumnKind('Decimal(18, 2)')).toBe('number');
    expect(getSqlColumnKind('Date')).toBe('date');
    expect(getSqlColumnKind("DateTime64(6, 'UTC')")).toBe('date');
    expect(getSqlColumnKind('LowCardinality(String)')).toBe('text');
    expect(getSqlColumnKind('Array(UInt8)')).toBe('text');
  });
});

describe('toSqlSeriesData', () => {
  it('pivots long format (x, label, value) into one series per label', () => {
    const result = toSqlSeriesData({
      columns: [
        { name: 'day', type: 'Date' },
        { name: 'event', type: 'String' },
        { name: 'c', type: 'UInt64' },
      ],
      rows: [
        ['2026-09-01', 'signup', 3],
        ['2026-09-01', 'login', 10],
        ['2026-09-02', 'login', 12],
        ['2026-09-02', 'login', 1],
      ],
    });

    expect(result).toEqual({
      xKind: 'date',
      series: [
        { key: 's0', name: 'signup' },
        { key: 's1', name: 'login' },
      ],
      data: [
        { x: '2026-09-01', s0: 3, s1: 10 },
        { x: '2026-09-02', s0: null, s1: 13 },
      ],
    });
  });

  it('uses every numeric column as a series in wide format', () => {
    const result = toSqlSeriesData({
      columns: [
        { name: 'day', type: 'Date' },
        { name: 'events.total', type: 'UInt64' },
        { name: 'users', type: 'Float64' },
      ],
      rows: [
        ['2026-09-01', 5, 2.5],
        ['2026-09-02', '7', null],
      ],
    });

    expect(result).toEqual({
      xKind: 'date',
      series: [
        { key: 's0', name: 'events.total' },
        { key: 's1', name: 'users' },
      ],
      data: [
        { x: '2026-09-01', s0: 5, s1: 2.5 },
        { x: '2026-09-02', s0: 7, s1: null },
      ],
    });
  });

  it('stays wide when there are several text columns', () => {
    const result = toSqlSeriesData({
      columns: [
        { name: 'day', type: 'Date' },
        { name: 'event', type: 'String' },
        { name: 'os', type: 'String' },
        { name: 'c', type: 'UInt64' },
      ],
      rows: [['2026-09-01', 'a', 'ios', 1]],
    });
    expect(result?.series).toEqual([{ key: 's0', name: 'c' }]);
  });

  it('returns null without a numeric column', () => {
    expect(
      toSqlSeriesData({
        columns: [
          { name: 'event', type: 'String' },
          { name: 'os', type: 'String' },
        ],
        rows: [['a', 'b']],
      }),
    ).toBeNull();
    expect(toSqlSeriesData({ columns: [], rows: [] })).toBeNull();
  });

  it('keeps only the biggest series when there are too many labels', () => {
    const labels = Array.from({ length: SQL_MAX_SERIES + 5 }, (_, i) => i);
    const result = toSqlSeriesData({
      columns: [
        { name: 'day', type: 'Date' },
        { name: 'label', type: 'String' },
        { name: 'c', type: 'UInt64' },
      ],
      rows: labels.map((i) => ['2026-09-01', `l${i}`, i]),
    });
    expect(result?.series).toHaveLength(SQL_MAX_SERIES);
    expect(result?.series.map(({ name }) => name)).not.toContain('l0');
    expect(result?.series.map(({ name }) => name)).toContain(
      `l${SQL_MAX_SERIES + 4}`,
    );
  });
});

describe('toSqlPieData', () => {
  it('uses the first column as label and the first numeric as value', () => {
    expect(
      toSqlPieData({
        columns: [
          { name: 'event', type: 'String' },
          { name: 'note', type: 'String' },
          { name: 'c', type: 'UInt64' },
        ],
        rows: [
          ['a', 'x', 4],
          [null, 'y', '6'],
          ['zero', 'z', 0],
        ],
      }),
    ).toEqual([
      { name: 'a', value: 4 },
      { name: 'null', value: 6 },
    ]);
  });
});

describe('toSqlPieData with many slices', () => {
  it('folds the smallest slices into Other', () => {
    const count = SQL_MAX_SERIES + 3;
    const slices = toSqlPieData({
      columns: [
        { name: 'label', type: 'String' },
        { name: 'c', type: 'UInt64' },
      ],
      rows: Array.from({ length: count }, (_, i) => [`l${i}`, i + 1]),
    });
    expect(slices).toHaveLength(SQL_MAX_SERIES);
    expect(slices[0]).toEqual({ name: `l${count - 1}`, value: count });
    // l0..l3 (values 1..4) are the four smallest.
    expect(slices.at(-1)).toEqual({ name: 'Other', value: 1 + 2 + 3 + 4 });
  });
});

describe('toSqlMetric', () => {
  it('returns the first numeric value of the first row', () => {
    expect(
      toSqlMetric({
        columns: [
          { name: 'label', type: 'String' },
          { name: 'total', type: 'UInt64' },
        ],
        rows: [
          ['all', 42],
          ['other', 1],
        ],
      }),
    ).toEqual({ name: 'total', value: 42 });
  });

  it('returns null for an empty result', () => {
    expect(
      toSqlMetric({ columns: [{ name: 'c', type: 'UInt64' }], rows: [] }),
    ).toBeNull();
  });
});
