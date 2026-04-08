import type { AdInfo } from './types';
import { adInfoStore, walkForAdLibraryMain } from './adStore';

/**
 * 从已加载的 HTML 中解析所有 <script type="application/json" data-sjs> 标签，
 * 提取首屏广告数据（Relay 服务端预加载，不经过 fetch）
 */
export function parseInlineScriptData(): void {
  document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]').forEach((el) => {
    try {
      const json = JSON.parse(el.textContent ?? "");
      const ads: AdInfo[] = [];
      walkForAdLibraryMain(json, ads);
      if (ads.length > 0) {
        for (const ad of ads) adInfoStore.set(ad.ad_archive_id, ad);
      }
    } catch (_) {
      /* 非 JSON 的 script 标签，忽略 */
    }
  });
}

/**
 * 解析 body > script:nth-child(61) 的内容
 */
export function parseAndLogScriptNthChild(): void {
  const el = document.querySelector<HTMLScriptElement>("#facebook > body > script:nth-of-type(55)");
  if (!el) return;

  const raw = el.textContent ?? "";
  try {
    const json = JSON.parse(raw);
    const ads: AdInfo[] = [];
    walkForAdLibraryMain(json, ads);
    if (ads.length > 0) {
      for (const ad of ads) adInfoStore.set(ad.ad_archive_id, ad);
    }
  } catch (_) {
    /* 解析失败，忽略 */
  }
}
