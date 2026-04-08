/**
 * 工具函数模块
 */

/**
 * 格式化 Unix 时间戳为 YYYY-MM-DD
 */
export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * 计算 Unix 时间戳距离今天的天数（正数表示未来，负数表示过去）
 */
export function getDaysFromToday(ts: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(ts * 1000);
  targetDate.setHours(0, 0, 0, 0);

  const timeDiff = today.getTime() - targetDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  if (daysDiff <= 1) return 1;
  return daysDiff;
}

/**
 * 检查是否为 Facebook Ads Library 页面
 */
export function isFacebookAdsLibraryPage(): boolean {
  return window.location.href.includes("facebook.com/ads/library");
}

/**
 * 检查是否启用详细调试日志
 */
export function isDebugVerbose(): boolean {
  return localStorage.getItem("adlib_pro_debug_verbose") === "1";
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
