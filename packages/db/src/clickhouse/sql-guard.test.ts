import { describe, expect, it } from 'vitest';
import {
  applySqlDateRange,
  normalizeSqlRows,
  validateUserSql,
} from './sql-guard';

function expectValid(sql: string) {
  const result = validateUserSql(sql);
  if (!result.valid) {
    throw new Error(`Expected valid, got: ${result.error}`);
  }
  return result.query;
}

function expectInvalid(sql: string) {
  const result = validateUserSql(sql);
  expect(result.valid).toBe(false);
  return result.valid ? '' : result.error;
}

describe('validateUserSql', () => {
  describe('valid queries', () => {
    it('accepts a plain SELECT', () => {
      expect(expectValid('SELECT 1')).toBe('SELECT 1');
    });

    it('is case insensitive', () => {
      expectValid('select count() from posthog.events');
    });

    it('accepts WITH', () => {
      expectValid(
        'WITH totals AS (SELECT event, count() AS c FROM events GROUP BY event)\nSELECT * FROM totals',
      );
    });

    it('accepts leading comments and whitespace', () => {
      const query = expectValid(
        '  -- top events\n/* multi\nline */\n  SELECT event FROM events -- trailing\n',
      );
      expect(query.startsWith('SELECT event FROM events')).toBe(true);
      expect(query).not.toContain('--');
      expect(query).not.toContain('/*');
    });

    it('strips a single trailing semicolon', () => {
      expect(expectValid('SELECT 1;')).toBe('SELECT 1');
      expect(expectValid('SELECT 1 ;  \n')).toBe('SELECT 1');
      expect(expectValid('SELECT 1; -- done')).toBe('SELECT 1');
    });

    it('ignores keywords and semicolons inside string literals', () => {
      const sql =
        "SELECT * FROM events WHERE event = 'drop; insert' AND name != \"set\"";
      expect(expectValid(sql)).toBe(sql);
    });

    it('keeps `--` inside a string literal', () => {
      expect(expectValid("SELECT '--not a comment' AS x")).toBe(
        "SELECT '--not a comment' AS x",
      );
    });

    it('handles escaped quotes in literals', () => {
      expectValid("SELECT 'it''s; drop' AS a, 'back\\'slash; alter' AS b");
    });

    it('allows keywords used as qualified identifiers', () => {
      expectValid('SELECT name FROM system.tables');
      expectValid('SELECT person_properties.$set FROM events');
    });

    it('allows SETTINGS that do not touch readonly', () => {
      expectValid('SELECT 1 SETTINGS max_threads = 2');
    });

    it('does not flag words that merely contain a keyword', () => {
      expectValid(
        'SELECT created_at, inserted_at, offset, dataset FROM events',
      );
    });
  });

  describe('invalid queries', () => {
    it('rejects empty input', () => {
      expectInvalid('   -- nothing\n');
    });

    it('rejects queries that do not start with SELECT or WITH', () => {
      expect(expectInvalid('SHOW TABLES')).toMatch(/SELECT or WITH/);
      expect(expectInvalid('INSERT INTO events VALUES (1)')).toMatch(
        /SELECT or WITH/,
      );
    });

    it('rejects two statements', () => {
      expect(expectInvalid('SELECT 1; SELECT 2')).toMatch(/single statement/);
      expect(expectInvalid('SELECT 1; DROP TABLE events;')).toMatch(
        /single statement/,
      );
    });

    it('rejects DDL and write keywords inside a SELECT', () => {
      for (const keyword of [
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
      ]) {
        expect(expectInvalid(`SELECT 1 ${keyword.toLowerCase()} x`)).toBe(
          `${keyword} statements are not allowed`,
        );
      }
    });

    it('rejects INSERT hidden behind a WITH', () => {
      expectInvalid('WITH 1 AS x INSERT INTO events SELECT x');
    });

    it('rejects a keyword hidden after a comment', () => {
      expectInvalid('SELECT 1 /* harmless */ DROP TABLE events');
    });

    it('rejects INTO OUTFILE', () => {
      expect(expectInvalid("SELECT * FROM events INTO OUTFILE 'x.csv'")).toMatch(
        /INTO OUTFILE/,
      );
    });

    it('rejects SETTINGS readonly', () => {
      expect(expectInvalid('SELECT 1 SETTINGS readonly = 0')).toMatch(
        /readonly/,
      );
      expect(
        expectInvalid('SELECT 1 SETTINGS max_threads = 1, READONLY = 0'),
      ).toMatch(/readonly/);
    });
  });
});

describe('applySqlDateRange', () => {
  const range = {
    startDate: '2026-09-05 00:00:00',
    endDate: '2026-10-06 00:00:00',
  };

  it('replaces both placeholders with escaped literals', () => {
    expect(
      applySqlDateRange(
        'SELECT 1 FROM events WHERE timestamp >= {{startDate}} AND timestamp < {{endDate}}',
        range,
      ),
    ).toBe(
      "SELECT 1 FROM events WHERE timestamp >= '2026-09-05 00:00:00' AND timestamp < '2026-10-06 00:00:00'",
    );
  });

  it('replaces every occurrence and tolerates inner spaces', () => {
    expect(
      applySqlDateRange('{{startDate}} {{ startDate }} {{endDate}}', range),
    ).toBe(
      "'2026-09-05 00:00:00' '2026-09-05 00:00:00' '2026-10-06 00:00:00'",
    );
  });

  it('escapes the values', () => {
    expect(
      applySqlDateRange('{{startDate}}', {
        startDate: "2026' OR 1=1 --",
        endDate: '',
      }),
    ).toBe("'2026\\' OR 1=1 --'");
  });

  it('leaves queries without placeholders untouched', () => {
    const sql = 'SELECT count() FROM events';
    expect(applySqlDateRange(sql, range)).toBe(sql);
  });
});

describe('normalizeSqlRows', () => {
  it('converts quoted 64-bit integers to numbers', () => {
    expect(
      normalizeSqlRows(
        [
          { name: 'event', type: 'String' },
          { name: 'c', type: 'UInt64' },
          { name: 'n', type: 'Nullable(Int64)' },
          { name: 'small', type: 'UInt8' },
        ],
        [
          ['a', '12', null, 3],
          ['b', '7', '-4', 1],
        ],
      ),
    ).toEqual([
      ['a', 12, null, 3],
      ['b', 7, -4, 1],
    ]);
  });

  it('returns rows untouched when there are no wide integers', () => {
    const rows = [['x', 1]];
    expect(
      normalizeSqlRows(
        [
          { name: 'a', type: 'String' },
          { name: 'b', type: 'Float64' },
        ],
        rows,
      ),
    ).toBe(rows);
  });
});
