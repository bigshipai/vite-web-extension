/**
 * URL 工具模块
 */

/**
 * 获取当前页面完整 URL
 */
export function getFullUrl(): string {
  return window.location.href;
}

/**
 * 解析 URL 参数，返回键值对对象
 */
export function parseUrlParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const paramObj: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    paramObj[key] = value;
  }

  return paramObj;
}

/**
 * 替换/新增 URL 参数，并返回新 URL
 */
export function createUrlWithNewParams(newParams: Record<string, string | number | boolean>): string {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const searchParams = new URLSearchParams(window.location.search);

  Object.entries(newParams).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * 替换参数并直接跳转页面
 */
export function redirectWithNewParams(
  newParams: Record<string, string | number | boolean>,
  replaceHistory = false
): void {
  const newUrl = createUrlWithNewParams(newParams);

  if (replaceHistory) {
    window.location.replace(newUrl);
  } else {
    window.location.href = newUrl;
  }
}
