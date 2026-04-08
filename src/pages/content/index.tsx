import "./style.css";
import { isFacebookAdsLibraryPage } from './utils';
import { parseInlineScriptData } from './dataParser';
import { injectStyles } from './styles';
import { setupMutationObserver } from './observer';

const INJECTED_FLAG_ATTR = "data-adlib-pro-injected";

/**
 * 初始化扩展
 */
function bootstrap(): void {
  if (!isFacebookAdsLibraryPage()) return;

  if (document.documentElement.hasAttribute(INJECTED_FLAG_ATTR)) return;

  // 设置已注入标志
  document.documentElement.setAttribute(INJECTED_FLAG_ATTR, "true");

  injectStyles();

  // 解析首屏内联 script JSON 数据
  parseInlineScriptData();

  // 首屏数据已就绪，立即填充信息面板
  setupMutationObserver();

  console.log("bootstrap: 完成初始化。");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
