/** Đọc điểm / cảnh báo từ `latest_estimation` — cùng nguồn với trang Compliance (điểm tổng quát). */

export function numValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** `null` = shop chưa có điểm hợp lệ (không xếp “rủi ro nhất” kiểu 0 mặc định). */
export function extractStoreComplianceScore(
  est: Record<string, unknown> | null | undefined
): number | null {
  if (!est) return null;
  const cd = est.calculation_detail as Record<string, unknown> | null | undefined;
  if (!cd) return null;
  const dash = (cd.dashboard ?? {}) as Record<string, unknown>;
  return numValue(dash.compliance_score ?? est.score);
}

export function extractStoreAlertsCount(est: Record<string, unknown> | null | undefined): number {
  if (!est) return 0;
  const cd = est.calculation_detail as Record<string, unknown> | null | undefined;
  const dash = (cd?.dashboard ?? {}) as Record<string, unknown>;
  const fromDash = numValue(dash.alerts_count);
  if (fromDash != null && fromDash > 0) return fromDash;
  const alerts = cd?.alerts;
  return Array.isArray(alerts) ? alerts.length : 0;
}

export type ShopComplianceRow = {
  name: string;
  score: number | null;
  alertCount: number;
};

export function buildShopComplianceRows(stores: { store_name?: string | null; store_code?: string | null; latest_estimation?: unknown }[]): ShopComplianceRow[] {
  return stores.map((s) => {
    const est = s.latest_estimation as Record<string, unknown> | null | undefined;
    return {
      name: s.store_name?.trim() || s.store_code || 'Shop',
      score: extractStoreComplianceScore(est),
      alertCount: extractStoreAlertsCount(est),
    };
  });
}

/** Shop rủi ro nhất = điểm thấp nhất trong các shop đã có điểm; hòa điểm → nhiều cảnh báo hơn. */
export function pickRiskiestShop(rows: ShopComplianceRow[]): ShopComplianceRow | null {
  const ranked = rows.filter((r): r is ShopComplianceRow & { score: number } => r.score != null);
  if (!ranked.length) return null;
  return [...ranked].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.alertCount - a.alertCount;
  })[0];
}
