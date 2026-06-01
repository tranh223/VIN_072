import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

type TableProps = HTMLAttributes<HTMLTableElement> & {
  /** Bỏ khung bọc ngoài (dùng trong card có sẵn viền) */
  bare?: boolean;
};

export function Table({
  className = '',
  bare,
  children,
  ...rest
}: TableProps) {
  const table = (
    <table
      className={`w-full border-collapse text-left text-sm ${bare ? '' : 'min-w-[640px]'} ${className}`}
      {...rest}
    >
      {children}
    </table>
  );
  if (bare) {
    return <div className="w-full overflow-x-auto">{table}</div>;
  }
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-outline-variant">
      {table}
    </div>
  );
}

export function TableHead({
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-surface/80 text-[10px] font-display font-bold uppercase tracking-[0.15em] text-outline ${className}`}
      {...rest}
    />
  );
}

export function TableBody({
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={`divide-y divide-outline-variant/25 ${className}`}
      {...rest}
    />
  );
}

export function TableRow({
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-primary/[0.04] ${className}`}
      {...rest}
    />
  );
}

export function TableHeaderCell({
  className = '',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-4 first:pl-6 last:pr-6 sm:px-6 sm:py-5 ${className}`}
      {...rest}
    />
  );
}

export function TableCell({
  className = '',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`px-4 py-4 align-middle first:pl-6 last:pr-6 sm:px-6 sm:py-5 ${className}`}
      {...rest}
    />
  );
}
