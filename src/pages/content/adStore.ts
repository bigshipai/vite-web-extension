import type { AdInfo } from './types';

/** ad_archive_id → AdInfo */
export const adInfoStore = new Map<string, AdInfo>();

/**
 * 从单个广告节点提取字段并推入 ads
 */
export function pushAd(item: unknown, ads: AdInfo[]): void {
  if (!item || typeof item !== "object") return;
  const s = item as Record<string, unknown>;
  const id = s.ad_archive_id;
  if (!id) return;
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  const body = (snap.body ?? {}) as Record<string, unknown>;
  ads.push({
    ad_archive_id: String(id),
    page_name: (s.page_name ?? snap.page_name ?? null) as string | undefined,
    caption: (body.text ?? snap.caption ?? null) as string | undefined,
    cta_text: (snap.cta_text ?? null) as string | undefined,
    page_id: (s.page_id ?? snap.page_id ?? null) as string | undefined,
    link_url: (s.link_url ?? snap.link_url ?? null) as string | undefined,
    page_like_count: (snap.page_like_count ?? null) as number | undefined,
    start_date: (s.start_date ?? null) as number | undefined,
  });
}

/**
 * 从 ad_library_main 提取所有广告并推入 ads 数组
 */
export function extractEdges(main: unknown, ads: AdInfo[]): void {
  if (!main || typeof main !== "object") return;
  const m = main as Record<string, unknown>;
  const conn = m.search_results_connection as Record<string, unknown> | undefined;
  if (!conn) return;

  const edges = (conn.edges as unknown[]) ?? [];

  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue;
    const node = ((edge as Record<string, unknown>).node ?? {}) as Record<string, unknown>;
    const collated = (node.collated_results as unknown[]) ?? [];
    for (const item of collated) {
      pushAd(item, ads);
    }
    if (node.ad_archive_id) pushAd(node, ads);
  }
}

/**
 * 递归遍历 JSON 查找 ad_library_main
 */
export function walkForAdLibraryMain(node: unknown, ads: AdInfo[], depth = 0): void {
  if (!node || typeof node !== "object" || depth > 12) return;
  const obj = node as Record<string, unknown>;

  if (obj.ad_library_main) {
    extractEdges(obj.ad_library_main, ads);
    return;
  }

  if (obj.__bbox) {
    walkForAdLibraryMain(obj.__bbox, ads, depth + 1);
    return;
  }

  if (obj.result) walkForAdLibraryMain(obj.result, ads, depth + 1);
  if (obj.data) walkForAdLibraryMain(obj.data, ads, depth + 1);
  if (obj.require) walkForAdLibraryMain(obj.require, ads, depth + 1);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkForAdLibraryMain(item, ads, depth + 1);
    }
  }
}
