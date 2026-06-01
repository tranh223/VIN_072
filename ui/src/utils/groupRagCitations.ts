import type { RagCitation } from '../api/types';

export type GroupedLawRef = {
  url: string;
  lawLabel: string;
  dieuList: string[];
};

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function sortDieu(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return parseInt(a, 10) - parseInt(b, 10);
  }
  return a.localeCompare(b, 'vi');
}

/**
 * Gom các citation cùng một văn bản pháp luật (ưu tiên khóa law_id, sau đó URL gốc)
 * để chỉ hiển thị một dòng với danh sách Điều và một liên kết.
 */
export function groupRagCitationsByDocument(citations: RagCitation[]): GroupedLawRef[] {
  type Acc = { url: string; lawLabel: string; dieu: Set<string> };
  const map = new Map<string, Acc>();

  for (const c of citations) {
    const url = (c.url ?? '').trim();
    if (!url) continue;

    const lawId = (c.law_id ?? '').trim();
    const key = lawId ? `law:${lawId}` : `url:${normalizeUrlKey(url)}`;

    const dieuRaw = (c.dieu ?? '').trim();
    const dieu = dieuRaw && dieuRaw !== 'N/A' ? dieuRaw : '';

    let acc = map.get(key);
    if (!acc) {
      const lawLabel = lawId || (c.law_name ?? '').trim() || url;
      acc = { url, lawLabel, dieu: new Set() };
      map.set(key, acc);
    }

    if (dieu) acc.dieu.add(dieu);
  }

  const out: GroupedLawRef[] = [];
  for (const acc of map.values()) {
    const dieuList = [...acc.dieu].sort(sortDieu);
    out.push({
      url: acc.url,
      lawLabel: acc.lawLabel,
      dieuList,
    });
  }

  return out;
}
