"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Enables click-to-sort on desktop. */
  sortValue?: (row: T) => number | string | null;
  className?: string;
  /**
   * Where the column goes in the phone card layout:
   * title / subtitle (left), value / valueSub (right), detail (label: value chips), hidden.
   */
  mobile?: "title" | "subtitle" | "value" | "valueSub" | "detail" | "hidden";
};

/**
 * Sortable table on desktop, compact stacked cards on phones (no horizontal scroll).
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  rowHref,
  onRowClick,
  empty,
  initialSort,
  pageSize,
  footer,
  className,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  getRowKey: (row: T) => string;
  rowHref?: (row: T) => string | null;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  initialSort?: { key: string; direction: "asc" | "desc" };
  /** Shows a "Show more" button after this many rows. */
  pageSize?: number;
  footer?: ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState(initialSort || null);
  const [visibleCount, setVisibleCount] = useState(pageSize || Number.POSITIVE_INFINITY);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;

    const column = columns.find((entry) => entry.key === sort.key);

    if (!column?.sortValue) return rows;

    const direction = sort.direction === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);

      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
      return String(a).localeCompare(String(b)) * direction;
    });
  }, [rows, columns, sort]);

  const visibleRows = sortedRows.slice(0, visibleCount);
  const hasMore = sortedRows.length > visibleRows.length;

  if (!rows.length) {
    return <>{empty || null}</>;
  }

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" }
    );
  }

  const pick = (slot: NonNullable<DataColumn<T>["mobile"]>) => columns.filter((column) => column.mobile === slot);

  return (
    <div className={cn("min-w-0", className)}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const SortIcon = !active ? ChevronsUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "px-3 py-2.5 text-xs font-medium whitespace-nowrap text-ink-3 first:pl-0 last:pr-0",
                      column.align === "right" ? "text-right" : "text-left",
                      column.className
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "inline-flex items-center gap-1 transition hover:text-ink",
                          column.align === "right" && "flex-row-reverse",
                          active && "text-ink"
                        )}
                      >
                        {column.header}
                        <SortIcon className={cn("size-3", !active && "opacity-40")} aria-hidden />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const href = rowHref?.(row) || null;
              const clickable = Boolean(href || onRowClick);

              return (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-line last:border-b-0",
                    clickable && "cursor-pointer transition hover:bg-surface-2"
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        "tabular px-3 py-3 align-middle first:pl-0 last:pr-0",
                        column.align === "right" ? "text-right" : "text-left",
                        column.className
                      )}
                    >
                      {href && index === 0 ? (
                        <Link href={href} className="block outline-none focus-visible:underline">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul className="divide-y divide-line md:hidden">
        {visibleRows.map((row) => {
          const href = rowHref?.(row) || null;
          const content = (
            <div className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {pick("title").map((column) => (
                    <div key={column.key} className="truncate text-sm font-medium text-ink">
                      {column.cell(row)}
                    </div>
                  ))}
                  {pick("subtitle").map((column) => (
                    <div key={column.key} className="mt-0.5 truncate text-xs text-ink-3">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
                <div className="shrink-0 text-right">
                  {pick("value").map((column) => (
                    <div key={column.key} className="tabular text-sm font-semibold text-ink">
                      {column.cell(row)}
                    </div>
                  ))}
                  {pick("valueSub").map((column) => (
                    <div key={column.key} className="tabular mt-0.5 text-xs">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
              </div>
              {pick("detail").length ? (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {pick("detail").map((column) => (
                    <div key={column.key} className="flex items-center gap-1 text-xs">
                      <dt className="text-ink-3">{column.header}</dt>
                      <dd className="tabular font-medium text-ink-2">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          );

          return (
            <li key={getRowKey(row)}>
              {href ? (
                <Link href={href} className="block active:bg-surface-2">
                  {content}
                </Link>
              ) : onRowClick ? (
                <button type="button" onClick={() => onRowClick(row)} className="block w-full text-left active:bg-surface-2">
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + (pageSize || 10))}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-soft"
          >
            Show more ({sortedRows.length - visibleRows.length})
          </button>
        </div>
      ) : null}
      {footer}
    </div>
  );
}
