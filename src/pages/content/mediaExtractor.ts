/**
 * 媒体资源提取和下载模块
 */

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
  chrome.runtime.sendMessage(
    { type: "DOWNLOAD_MEDIA", url, filename },
    (resp) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (!resp?.ok) {
        console.log("下载失败", resp?.error ?? "未知错误");
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
