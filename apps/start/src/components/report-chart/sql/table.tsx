import { cn } from '@/utils/cn';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';

import { formatSqlValue } from './format';
import {
  getSqlColumnKind,
  type SqlColumnKind,
  type SqlResultColumn,
  toSqlNumber,
} from './transform';

type SqlRow = unknown[];

const ROW_HEIGHT = 40;
const MIN_COLUMN_WIDTH = 120;

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    sqlKind?: SqlColumnKind;
  }
}

function compareSqlValues(a: unknown, b: unknown): number {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return 1;
  }
  if (b === null || b === undefined) {
    return -1;
  }
  const numberA = toSqlNumber(a);
  const numberB = toSqlNumber(b);
  if (numberA !== null && numberB !== null) {
    return numberA - numberB;
  }
  return String(a).localeCompare(String(b));
}

interface SqlTableProps {
  columns: SqlResultColumn[];
  rows: SqlRow[];
  className?: string;
}

export function SqlTable({ columns, rows, className }: SqlTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnDefs = useMemo<ColumnDef<SqlRow>[]>(
    () =>
      columns.map((column, index) => ({
        id: `c${index}`,
        header: column.name,
        accessorFn: (row) => row[index],
        sortingFn: (rowA, rowB, columnId) =>
          compareSqlValues(rowA.getValue(columnId), rowB.getValue(columnId)),
        sortUndefined: 'last',
        meta: { sqlKind: getSqlColumnKind(column.type) },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Required by the app-wide FilterFns augmentation; this table has no
    // column filters.
    filterFns: {
      isWithinRange: () => true,
    },
  });

  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  return (
    <div
      className={cn(
        'overflow-auto rounded-lg border bg-card',
        className,
      )}
      ref={scrollRef}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr className="border-b" key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isNumber =
                  header.column.columnDef.meta?.sqlKind === 'number';
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    className={cn(
                      'h-10 whitespace-nowrap border-r bg-muted/30 px-4 font-semibold text-[10px] uppercase last:border-r-0',
                      isNumber ? 'text-right' : 'text-left',
                    )}
                    key={header.id}
                    style={{ minWidth: MIN_COLUMN_WIDTH }}
                  >
                    <button
                      className={cn(
                        'inline-flex items-center gap-1.5 uppercase hover:opacity-70',
                        isNumber && 'flex-row-reverse',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      type="button"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <span className="text-muted-foreground">
                        {sorted === 'asc' && '↑'}
                        {sorted === 'desc' && '↓'}
                        {!sorted && '⇅'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <tr
                className="border-b transition-colors hover:bg-muted/30"
                key={row.id}
                style={{ height: ROW_HEIGHT }}
              >
                {row.getVisibleCells().map((cell) => {
                  const kind = cell.column.columnDef.meta?.sqlKind ?? 'text';
                  const value = cell.getValue();
                  const formatted = formatSqlValue(value, kind);
                  return (
                    <td
                      className={cn(
                        'max-w-96 truncate border-r px-4 last:border-r-0',
                        kind === 'number' && 'text-right font-mono',
                        (value === null || value === undefined) &&
                          'text-muted-foreground italic',
                      )}
                      key={cell.id}
                      title={typeof value === 'string' ? value : formatted}
                    >
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
