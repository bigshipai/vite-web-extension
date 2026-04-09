import type { AdInfo } from './types';
import { adInfoStore } from './adStore';
import { createUrlWithNewParams } from './urlUtils';
import { extractMediaUrls, downloadViaBackground, buildFilename } from './mediaExtractor';
import { buildInfoPanel, updateInfoPanelInToolbar } from './uiComponents';

export const ACTIONS_WRAP_CLASS = "adlib-pro-inline-actions";
export const ACTION_BUTTON_CLASS = "adlib-pro-inline-btn";
export const TOOLBAR_WRAP_CLASS = "adlib-pro-toolbar-sibling";
export const TOOLBAR_ABOVE_HR_CLASS = "adlib-pro-toolbar-above-hr";
export const AD_DIVIDER_HR_SELECTOR_EXACT =
  "hr.xjbqb8w.xso031l.x1q0q8m5.xqtp20y.xb9moi8.xe76qn7.x21b0me.x142aazg.xw7yly9.x1ys307a.x1yztbdb.xyqm7xq";

/**
 * 从广告卡片找到广告详情页 URL
 */
export function findAdDetailUrl(context: HTMLElement): string | null {
  const adlibarayId = findAdLibraryIdByAttr(context);
  const adsinfo = adInfoStore.get(adlibarayId);
  if (!adsinfo) return null;

  const newUrl = createUrlWithNewParams({
    view_all_page_id: adsinfo?.page_id ?? '',
    country: "ALL",
    search_type: "page"
  });
  return newUrl;
}

/**
 * 打开链接广告 URL
 */
export function openLinkAdsUrl(context: HTMLElement): string | null {
  const adlibarayId = findAdLibraryIdByAttr(context);
  const adsinfo = adInfoStore.get(adlibarayId);
  if (!adsinfo) return null;

  const newUrl = createUrlWithNewParams({
    q: getHostname(adsinfo?.link_url),
    view_all_page_id:""
  });
  return newUrl;
}

/**
 * 安全获取 URL 的 hostname
 */
function getHostname(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname || '';
  } catch {
    return '';
  }
}

/**
 * 构建操作按钮容器
 */
export function buildActionsWrap(anchorDiv: HTMLElement): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = ACTIONS_WRAP_CLASS;
  wrap.appendChild(createInlineButton("Open Page Ads", "open-page-ads", anchorDiv));
  wrap.appendChild(createInlineButton("Open Link Ads", "open-link-ads", anchorDiv));
  wrap.appendChild(createInlineButton("Download", "download", anchorDiv));
  return wrap;
}

/**
 * 创建内联按钮
 */
function createInlineButton(label: string, actionKey: string, anchorDiv: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = ACTION_BUTTON_CLASS;
  button.textContent = label;
  button.dataset.action = actionKey;
  button.addEventListener("click", () => {
    handleToolbarAction(actionKey, anchorDiv);
  });
  return button;
}

/**
 * 处理工具栏操作
 */
function handleToolbarAction(actionKey: string, anchorDiv: HTMLElement): void {
  switch (actionKey) {
    case "open-page-ads": {
      const url = findAdDetailUrl(anchorDiv);
      if (url) {
        chrome.runtime.sendMessage({ type: "OPEN_TAB", url });
      } else {
        window.alert("未找到广告详情链接，请确认当前广告卡片已完全加载。");
      }
      break;
    }

    case "open-link-ads": {
      const url = openLinkAdsUrl(anchorDiv);
      if (url) {
        chrome.runtime.sendMessage({ type: "OPEN_TAB", url });
      } else {
        window.alert("当前页面未找到任何广告链接，请等待页面加载完成后重试。");
      }
      break;
    }

    case "download": {
      const { images, videos } = extractMediaUrls(anchorDiv);
      if (images.length === 0 && videos.length === 0) {
        window.alert("当前广告卡片中未找到可下载的图片或视频，请等待媒体加载完成后重试。");
        break;
      }

      if (videos.length > 0) {
        videos.forEach((url, i) => {
          const ext = url.includes(".mp4") ? "mp4" : url.includes(".webm") ? "webm" : "mp4";
          downloadViaBackground(url, buildFilename(url, i, ext));
        });
      } else {
        images.forEach((url, i) => {
          const ext = url.includes(".png") ? "png" : url.includes(".webp") ? "webp" : "jpg";
          downloadViaBackground(url, buildFilename(url, i, ext));
        });
      }
      break;
    }

    default:
      window.alert(`未知动作: ${actionKey}`);
  }
}

/**
 * 查找分隔线 HR 元素
 */
export function findDividerHrElements(): HTMLHRElement[] {
  return Array.from(document.querySelectorAll<HTMLHRElement>(AD_DIVIDER_HR_SELECTOR_EXACT));
}

/**
 * 从 hr 向上找广告卡片范围
 */
export function getAdContextFromHr(hr: HTMLElement): HTMLElement {
  let p: HTMLElement | null = hr.parentElement;
  for (let i = 0; i < 8 && p; i += 1) {
    if (p.children.length >= 2) return p;
    p = p.parentElement;
  }
  return hr.parentElement ?? hr;
}

/**
 * 通过属性查找广告 Library ID
 */
export function findAdLibraryIdByAttr(context: HTMLElement): string {
  for (let i = 0; i < context.children.length; i++) {
    const child = context.children[i];
    if (child.hasAttribute("data-ad-id")) {
      return child.getAttribute("data-ad-id")?.trim() || "";
    }
  }
  return "";
}

/**
 * 递归查找广告 Library ID
 */
export function findAdLibraryId(hr: HTMLElement, element: HTMLElement, q: string): void {
  if (!element) return;

  if (element.children.length > 0) {
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      findAdLibraryId(hr, child as HTMLElement, q);
    }
  } else {
    const textContent = element.textContent?.trim();
    if (textContent && textContent.startsWith(q)) {
      const parts = textContent.split(":");
      if (parts.length >= 2) {
        const adId = parts[1]?.trim();
        const parent = hr.parentElement ?? null;
        if (parent) {
          const adElement = parent.querySelector<HTMLElement>(`div[data-ad-id="${adId}"]`);
          if (adElement) return;
        }

        const outer = document.createElement("div");
        outer.className = `${TOOLBAR_ABOVE_HR_CLASS}`;

        const context = getAdContextFromHr(hr);
        if (adId) outer.setAttribute("data-ad-id", adId);
        outer.appendChild(buildActionsWrap(context));
        if (parent) parent.insertBefore(outer, hr);

        const adinfo: AdInfo | null = adInfoStore.get(adId) ?? null;
        if (adId) updateInfoPanelInToolbar(outer, adinfo);
        return;
      }
    }
  }
}

/**
 * 在目标 hr 正上方插入工具栏
 */
export function injectToolbarAboveHr(hr: HTMLHRElement): boolean {
  const prev = hr.previousElementSibling;
  if (prev?.classList.contains(TOOLBAR_ABOVE_HR_CLASS)) {
    return false;
  }

  const parent = hr.parentElement;
  if (!parent) return false;

  const context = getAdContextFromHr(hr);
  findAdLibraryId(hr, context, "Library ID:");
  return true;
}
