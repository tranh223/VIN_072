import type { StoreSummary } from '../api/types';
import { extractStoreAlertsCount } from './storeCompliance';

export type StoreDossierBadge = {
  status: 'synced' | 'processing' | 'error';
  label: string;
  missingItems: string[];
};

function asDossier(shop: StoreSummary): Record<string, unknown> {
  return (shop.dossier ?? {}) as Record<string, unknown>;
}

/** Trạng thái hồ sơ — cùng tiêu chí checklist cuối năm (doanh thu 12 kỳ, ước tính, chứng từ). */
export function getStoreDossierBadge(shop: StoreSummary): StoreDossierBadge {
  const fromApi = shop.dossier_missing_items?.filter((s) => s.trim()) ?? [];
  const dossier = asDossier(shop);
  const revenueMonths = Number(dossier.revenue_months_count ?? 0);
  const hasRevenue = revenueMonths > 0 || Boolean(shop.latest_report);
  const hasEstimation = Boolean(dossier.has_tax_estimation) || Boolean(shop.latest_estimation);
  const hasEvidence = Boolean(dossier.has_evidence);
  const missingItems =
    fromApi.length > 0
      ? fromApi
      : buildMissingItemsFallback(shop, { revenueMonths, hasRevenue, hasEstimation, hasEvidence });

  if (!hasRevenue) {
    return {
      status: 'processing',
      label: 'Chưa có báo cáo doanh thu',
      missingItems: ['Chưa upload CSV doanh thu cho shop này'],
    };
  }

  if (missingItems.length > 0) {
    const primary = missingItems.some((m) => m.includes('chứng từ'))
      ? 'Cần bổ sung chứng từ'
      : missingItems.some((m) => m.includes('Thiếu CSV'))
        ? 'Thiếu kỳ doanh thu'
        : 'Cần hoàn thiện hồ sơ';
    return { status: 'error', label: primary, missingItems };
  }

  const alerts = extractStoreAlertsCount(
    shop.latest_estimation as Record<string, unknown> | null | undefined,
  );
  if (alerts > 0) {
    return {
      status: 'processing',
      label: 'Cần kiểm tra cảnh báo',
      missingItems: [`${alerts} cảnh báo cần xem tại Tuân thủ / Upload`],
    };
  }

  return { status: 'synced', label: 'Đã đủ hồ sơ', missingItems: [] };
}

function buildMissingItemsFallback(
  shop: StoreSummary,
  ctx: {
    revenueMonths: number;
    hasRevenue: boolean;
    hasEstimation: boolean;
    hasEvidence: boolean;
  },
): string[] {
  const items: string[] = [];
  const dossier = asDossier(shop);
  const missing = (dossier.missing_revenue_months as number[] | undefined) ?? [];
  if (missing.length) {
    items.push(
      `Thiếu CSV doanh thu các tháng: ${missing.map((m) => `T${String(Number(m)).padStart(2, '0')}`).join(', ')}`,
    );
  } else if (ctx.hasRevenue && ctx.revenueMonths > 0 && ctx.revenueMonths < 12) {
    items.push(`Mới có ${ctx.revenueMonths}/12 kỳ doanh thu trong năm`);
  }
  if (ctx.hasRevenue && !ctx.hasEstimation) {
    items.push('Chưa có ước tính thuế cho các kỳ đã upload');
  }
  if (ctx.hasRevenue && !ctx.hasEvidence) {
    const evCount = Number(dossier.evidence_count ?? 0);
    const covered = Number(dossier.evidence_months_covered ?? 0);
    const required = Number(dossier.evidence_months_required ?? ctx.revenueMonths);
    if (evCount <= 0) {
      items.push('Chưa có chứng từ giao dịch (ảnh/PDF) trong năm');
    } else {
      items.push(`Thiếu chứng từ một số kỳ (${covered}/${required} kỳ đã có doanh thu)`);
    }
  }
  return items;
}

export function parseLatestPeriod(period?: string | null): { month: number; year: number } | null {
  if (!period) return null;
  const m = period.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (month >= 1 && month <= 12 && year >= 2000) return { month, year };
  return null;
}
