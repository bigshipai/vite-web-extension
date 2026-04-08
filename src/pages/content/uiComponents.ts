import type { AdInfo } from './types';
import { formatDate, getDaysFromToday } from './utils';

export const AD_INFO_PANEL_CLASS = "adlib-pro-info-panel";

/**
 * 构建信息面板 DOM
 */
export function buildInfoPanel(ad: AdInfo): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = AD_INFO_PANEL_CLASS;

  const rows: Array<[string, string]> = [];
  if (ad.page_like_count != null) rows.push(["Likes:", ad.page_like_count.toLocaleString()]);
  if (ad.start_date != null) rows.push(["Started:", formatDate(ad.start_date) + " (Active " + getDaysFromToday(ad.start_date) + " days)"]);
  if (ad.cta_text) rows.push(["CTA:", ad.cta_text]);

  if (ad.link_url) {
    try {
      const url = new URL(ad.link_url);
      rows.push(["Link:", url.hostname]);
    } catch {
      // ignore invalid URL errors
    }
  }

  panel.innerHTML = rows
    .map(([k, v]) => `<span class="adlib-pro-info-key">${k}</span><span class="adlib-pro-info-val">${escapeHtml(v)}</span>`)
    .join("");
  return panel;
}

/**
 * HTML 转义
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 更新或插入某个工具栏容器内的信息面板
 */
export function updateInfoPanelInToolbar(toolbarOuter: HTMLElement, ad: AdInfo | null): void {
  const adId = toolbarOuter.getAttribute("data-ad-id");
  if (!adId) return;
  let panel = toolbarOuter.querySelector<HTMLDivElement>(`.${AD_INFO_PANEL_CLASS}`);
  if (!ad) return;

  if (!panel) {
    panel = buildInfoPanel(ad);
    toolbarOuter.appendChild(panel);
  } else {
    const fresh = buildInfoPanel(ad);
    panel.replaceWith(fresh);
  }
}
