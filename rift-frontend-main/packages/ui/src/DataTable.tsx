'use client';
import * as React from 'react';
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type Row,
} from '@tanstack/react-table';
import { cn } from './cn';
import { Icon } from './Icon';

/**
 * Generous row height, a state layer on hover, and no zebra striping — rows
 * separate by hairline and tonal fill, the way MD3 lists do.
 *
 * A row click opens a drawer rather than navigating away; pass `onRowClick`
 * and render the drawer yourself.
 */
/**
 * The column's header as plain text, for the stacked layout's cell labels.
 *
 * Only a string header can become one. A header rendered as a component could
 * be anything — an icon, a control, a sort button — and forcing it through
 * `String()` would print `[object Object]` next to every value. Those cells go
 * unlabelled instead, which reads as a value with no caption rather than as a
 * bug.
 */
function headerLabel(header: unknown): string | undefined {
  return typeof header === 'string' && header.trim() ? header : undefined;
}

export function DataTable<T>({
  data, columns, sorting, onSortingChange, onRowClick, isRowActive, empty, minWidth, maxHeight, className,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  onRowClick?: (row: Row<T>) => void;
  isRowActive?: (row: Row<T>) => boolean;
  empty?: React.ReactNode;
  minWidth?: number;
  maxHeight?: number;
  className?: string;
}) {
  const [internal, setInternal] = React.useState<SortingState>([]);
  const sort = sorting ?? internal;

  const table = useReactTable({
    data,
    columns,
    state: { sorting: sort },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sort) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternal(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn('overflow-auto', className)} style={maxHeight ? { maxHeight } : undefined}>
      {/* `data-stack` opts this table into the card layout below `md`, defined
          once in globals.css. A data table is the worst thing to read on a
          phone: `minWidth` here is 880-980px, so every row means swiping
          sideways and losing the column you were comparing against. Stacked,
          each row becomes a card and each cell carries its own header.

          The min-width is applied through a custom property rather than the
          style attribute so the stacked rules can drop it. An inline style
          would win over any media query and the cards would still be 900px
          wide. */}
      <table
        data-stack
        className="w-full border-collapse"
        style={minWidth ? ({ ['--md-table-min' as string]: `${minWidth}px` } as React.CSSProperties) : undefined}
      >
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                const align = (h.column.columnDef.meta as { align?: 'left' | 'right' } | undefined)?.align ?? 'left';
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    style={h.getSize() !== 150 ? { width: h.getSize() } : undefined}
                    className={cn(
                      'sticky top-0 z-[2] h-14 whitespace-nowrap bg-md-surface-container px-4',
                      'text-label-small font-medium uppercase tracking-[0.08em]',
                      align === 'right' ? 'text-right' : 'text-left',
                      dir ? 'text-md-primary' : 'text-md-on-surface-variant',
                    )}
                  >
                    {h.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          'group -mx-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-inherit',
                          'transition-colors duration-[--md-duration-fast] ease-md hover:bg-md-primary/10',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
                          align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <Icon
                          name={dir ? 'chevronDown' : 'chevronUpDown'}
                          size={14}
                          className={cn(
                            'transition-all duration-[--md-duration-fast] ease-md',
                            dir ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
                            dir === 'asc' && 'rotate-180',
                          )}
                        />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => {
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={row.id}
                onClick={clickable ? () => onRowClick!(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick!(row); } }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'button' : undefined}
                className={cn(
                  'group border-b border-md-outline-variant/40 transition-colors duration-[--md-duration-fast] ease-md',
                  clickable && 'cursor-pointer hover:bg-md-primary/8 focus-visible:bg-md-primary/8 focus-visible:outline-none',
                  isRowActive?.(row) && 'bg-md-secondary-container/60',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: 'left' | 'right' } | undefined)?.align ?? 'left';
                  return (
                    <td
                      key={cell.id}
                      // Stacked, the header row is gone, so each cell has to
                      // say what it is. Taken from the column definition so it
                      // cannot drift from the header it replaces.
                      data-label={headerLabel(cell.column.columnDef.header)}
                      className={cn(
                        'px-4 py-4 align-middle text-body-medium text-md-on-surface-variant',
                        align === 'right' && 'text-right',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Chevron that slides in on row hover — the affordance for "opens a drawer". */
export function RowPeek() {
  return (
    <Icon
      name="chevronRight"
      size={20}
      className="inline-block -translate-x-1 text-md-primary opacity-0 transition-all duration-[--md-duration-fast] ease-md group-hover:translate-x-0 group-hover:opacity-100"
    />
  );
}
