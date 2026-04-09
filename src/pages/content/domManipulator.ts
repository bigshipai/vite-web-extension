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
const LICENSE_INVALID_MESSAGE = "Your key is invalid. Please contact customer support to renew your plan.";
const LIMIT_REACHED_MESSAGE = "You have exceeded the trial limit. Please contact customer support to renew your plan.";

interface RuntimeResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

interface RuntimeApi {
  sendMessage: (
    message: { type: string; url: string },
    callback: (resp: RuntimeResponse) => void
  ) => void;
  lastError?: { message?: string };
}

function getRuntimeApi(): RuntimeApi | null {
  const runtimeFromChrome = globalThis.chrome?.runtime as RuntimeApi | undefined;
  if (runtimeFromChrome?.sendMessage) return runtimeFromChrome;

  const runtimeFromBrowser = (
    globalThis as typeof globalThis & {
      browser?: { runtime?: RuntimeApi };
    }
  ).browser?.runtime;
  if (runtimeFromBrowser?.sendMessage) return runtimeFromBrowser;

  return null;
}

function sendOpenTabMessage(url: string, onResponse: (resp: RuntimeResponse) => void): boolean {
  const runtimeApi = getRuntimeApi();
  if (!runtimeApi) {
    showErrorToast("Extension runtime is unavailable on this page. Please reload the extension and try again.", "Extension unavailable");
    return false;
  }
  runtimeApi.sendMessage({ type: "OPEN_TAB", url }, onResponse);
  return true;
}

function ensureErrorToastStyle(): void {
  if (document.getElementById("adlib-pro-error-toast-style")) return;

  const style = document.createElement("style");
  style.id = "adlib-pro-error-toast-style";
  style.textContent = `
    #adlib-pro-error-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      width: min(360px, calc(100vw - 24px));
      border-radius: 12px;
      border: 1px solid rgba(220, 38, 38, 0.28);
      background: linear-gradient(180deg, #fff5f5 0%, #ffffff 100%);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
      color: #7f1d1d;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      animation: adlibErrorToastIn .18s ease-out;
    }

    #adlib-pro-error-toast .adlib-pro-error-content {
      padding: 12px 14px;
      display: grid;
      gap: 6px;
    }

    #adlib-pro-error-toast .adlib-pro-error-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.25;
      color: #991b1b;
    }

    #adlib-pro-error-toast .adlib-pro-error-message {
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
      color: #7f1d1d;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #adlib-pro-error-toast .adlib-pro-error-close {
      position: absolute;
      top: 6px;
      right: 8px;
      border: 0;
      background: transparent;
      color: #b91c1c;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 4px;
    }

    @keyframes adlibErrorToastIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  document.head.appendChild(style);
}

function showErrorToast(message: string, title = "Action failed"): void {
  ensureErrorToastStyle();

  const existing = document.getElementById("adlib-pro-error-toast");
  if (existing) existing.remove();

  const toast = document.createElement("section");
  toast.id = "adlib-pro-error-toast";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");

  const content = document.createElement("div");
  content.className = "adlib-pro-error-content";

  const titleEl = document.createElement("p");
  titleEl.className = "adlib-pro-error-title";
  titleEl.textContent = title;

  const messageEl = document.createElement("p");
  messageEl.className = "adlib-pro-error-message";
  messageEl.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.className = "adlib-pro-error-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Dismiss error");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    toast.remove();
  });

  content.appendChild(titleEl);
  content.appendChild(messageEl);
  toast.appendChild(content);
  toast.appendChild(closeButton);
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 6000);
}

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
    search_type: "page",
    q:""
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
        sendOpenTabMessage(url, (resp: RuntimeResponse) => {
          const runtimeApi = getRuntimeApi();
          if (runtimeApi?.lastError) return;
          if (!resp?.ok && resp?.error === "KEY_INVALID") {
            showErrorToast(resp?.message ?? LICENSE_INVALID_MESSAGE, "License issue");
          }
          if (!resp?.ok && resp?.error === "LIMIT_REACHED") {
            showErrorToast(resp?.message ?? LIMIT_REACHED_MESSAGE, "Trial limit reached");
          }
        });
      } else {
        showErrorToast("Ad detail link was not found. Please make sure the ad card is fully loaded.");
      }
      break;
    }

    case "open-link-ads": {
      const url = openLinkAdsUrl(anchorDiv);
      if (url) {
        sendOpenTabMessage(url, (resp: RuntimeResponse) => {
          const runtimeApi = getRuntimeApi();
          if (runtimeApi?.lastError) return;
          if (!resp?.ok && resp?.error === "KEY_INVALID") {
            showErrorToast(resp?.message ?? LICENSE_INVALID_MESSAGE, "License issue");
          }
          if (!resp?.ok && resp?.error === "LIMIT_REACHED") {
            showErrorToast(resp?.message ?? LIMIT_REACHED_MESSAGE, "Trial limit reached");
          }
        });
      } else {
        showErrorToast("No ad links were found on this page. Please wait until the page is fully loaded and try again.");
      }
      break;
    }

    case "download": {
      const { images, videos } = extractMediaUrls(anchorDiv);
      if (images.length === 0 && videos.length === 0) {
        showErrorToast("No downloadable images or videos were found in this ad card. Please wait for media to load and try again.");
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
      showErrorToast(`Unknown action: ${actionKey}`);
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
