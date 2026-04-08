import { isDebugVerbose } from './utils';
import { findDividerHrElements, injectToolbarAboveHr } from './domManipulator';

/**
 * 扫描并添加内联操作按钮
 */
export function addInlineActionsForCard(): void {
  const hrs = findDividerHrElements();
  if (hrs.length > 0) {
    let newlyInjected = 0;
    for (const hr of hrs) {
      if (injectToolbarAboveHr(hr)) newlyInjected += 1;
    }
  }
}

/**
 * 设置 DOM 变化监听器
 */
export function setupMutationObserver(): void {
  let debounceHandle: number | undefined;
  let pendingScheduleLogged = false;

  const scheduleWork = (): void => {
    if (debounceHandle !== undefined) {
      if (isDebugVerbose() && !pendingScheduleLogged) {
        pendingScheduleLogged = true;
        console.log("MutationObserver: DOM 变化，已有待执行扫描，合并到同一防抖窗口");
      }
      return;
    }
    debounceHandle = window.setTimeout(() => {
      debounceHandle = undefined;
      pendingScheduleLogged = false;
      try {
        console.log("MutationObserver: 防抖结束，执行扫描");
        addInlineActionsForCard();
      } catch (e) {
        console.log("addInlineActionsForCard 异常", e);
      }
    }, 1000);
  };

  const root = document.querySelector<HTMLElement>('div[role="main"]') ?? document.body;

  const observer = new MutationObserver(() => {
    scheduleWork();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}
