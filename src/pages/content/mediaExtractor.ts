/**
 * 媒体资源提取和下载模块
 */

interface DownloadResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

interface RuntimeApi {
  sendMessage: (
    message: { type: string; url: string; filename: string },
    callback: (resp: DownloadResponse) => void
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
  }, 3000);
}

/**
 * 从广告卡片上下文提取所有图片/视频 URL
 */
export function extractMediaUrls(context: HTMLElement): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];

  // 视频：<video src> 或 <source src>
  context.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
    if (v.src && !v.src.startsWith("blob:")) videos.push(v.src);
    v.querySelectorAll<HTMLSourceElement>("source").forEach((s) => {
      if (s.src && !s.src.startsWith("blob:")) videos.push(s.src);
    });
  });

  // 图片：<img src>（过滤掉 1×1 追踪像素和 svg）
  context.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const src = img.src;
    if (!src || src.startsWith("data:") || src.endsWith(".svg")) return;
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) return;
    // 过滤掉头像照片
    if (img.className.startsWith("_8nqq img")) return;
    images.push(src);
  });

  // 背景图：style="background-image: url(...)"
  context.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const m = el.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (m?.[1] && !m[1].startsWith("data:")) images.push(m[1]);
  });

  return {
    images: [...new Set(images)],
    videos: [...new Set(videos)],
  };
}

/**
 * 通过 background script 下载单个文件
 */
export function downloadViaBackground(url: string, filename: string): void {
  const runtimeApi = getRuntimeApi();
  if (!runtimeApi) {
    showErrorToast("Extension runtime is unavailable on this page. Please reload the extension and try again.", "Extension unavailable");
    return;
  }

  runtimeApi.sendMessage(
    { type: "DOWNLOAD_MEDIA", url, filename },
    (resp: DownloadResponse) => {
      if (runtimeApi.lastError) {
        showErrorToast("Download failed. Please try again later.", "Download failed");
        return;
      }
      if (!resp?.ok) {
        if (resp?.error === "KEY_INVALID") {
          showErrorToast(
            resp?.message ?? "Your key is invalid. Please contact customer support to renew your plan.",
            "License issue"
          );
          return;
        }
        if (resp?.error === "LIMIT_REACHED") {
          showErrorToast(
            resp?.message ?? "You have exceeded the trial limit. Please contact customer support to renew your plan.",
            "Trial limit reached"
          );
          return;
        }
        showErrorToast(`Download failed: ${resp?.error ?? "Unknown error"}`, "Download failed");
      }
    }
  );
}

/**
 * 生成文件名（从 URL 提取，必要时加序号和时间戳）
 */
export function buildFilename(url: string, index: number, ext?: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").filter(Boolean).pop() ?? `media_${index}`;
    const dotIdx = base.lastIndexOf(".");
    const name = dotIdx > 0 ? base.slice(0, dotIdx) : base;
    const extension = ext ?? (dotIdx > 0 ? base.slice(dotIdx + 1) : "jpg");
    return `adlib-pro/${Date.now()}_${index}_${name}.${extension}`;
  } catch {
    return `adlib-pro/${Date.now()}_${index}.${ext ?? "jpg"}`;
  }
}
