/** Định dạng tiền VND hiển thị */
export function formatVnd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value)))} đ`;
}

export function formatNumberVi(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value)));
}

/** Đọc số tiền kèm đơn vị (triệu / nghìn) — tránh hiểu nhầm dấu chấm ngăn cách hàng nghìn. */
export function formatVndReadable(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n) || n <= 0) return '0 đồng';
  if (n >= 1_000_000_000) {
    const t = n / 1_000_000_000;
    return `${Number.isInteger(t) ? formatNumberVi(t) : t.toFixed(2).replace('.', ',')} tỷ đồng`;
  }
  if (n >= 1_000_000) {
    const tr = n / 1_000_000;
    return `${Number.isInteger(tr) ? formatNumberVi(tr) : tr.toFixed(2).replace('.', ',')} triệu đồng`;
  }
  if (n >= 1_000) {
    const ng = n / 1_000;
    return `${Number.isInteger(ng) ? formatNumberVi(ng) : ng.toFixed(1).replace('.', ',')} nghìn đồng`;
  }
  return `${formatNumberVi(n)} đồng`;
}
