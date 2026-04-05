import "./style.css";

const ADS_LIBRARY_PATH = "/ads/library";
const INJECTED_FLAG_ATTR = "data-adlib-pro-injected";
const STYLE_TAG_ID = "adlib-pro-style-tag";
const ACTIONS_WRAP_CLASS = "adlib-pro-inline-actions";
const ACTION_BUTTON_CLASS = "adlib-pro-inline-btn";
/** 插在「文案所在 div」后面的兄弟容器，便于去重 */
const TOOLBAR_WRAP_CLASS = "adlib-pro-toolbar-sibling";

/** 插在目标 <hr> 正上方的工具栏容器（会附带与 hr 相同的 FB class 以统一版式） */
const TOOLBAR_ABOVE_HR_CLASS = "adlib-pro-toolbar-above-hr";

/**
 * Ads Library 分隔线 hr（与页面一致；FB 改版时可用 FALLBACK 或改此处）
 */
const AD_DIVIDER_HR_SELECTOR_EXACT =
  "hr.xjbqb8w.xso031l.x1q0q8m5.xqtp20y.xb9moi8.xe76qn7.x21b0me.x142aazg.xw7yly9.x1ys307a.x1yztbdb.xyqm7xq";

const AD_DIVIDER_HR_SELECTOR_FALLBACK =
  "hr.xjbqb8w.xso031l.x1q0q8m5.xqtp20y.xb9moi8";

/** 与 Facebook 文案一致（全词匹配，空白规范化） */
const AD_TEXT_PHRASES = ["See ad details", "See summary details"] as const;

const LOG_NS = "[AdLib Pro]";

function isDebugVerbose(): boolean {
  try {
    return window.localStorage.getItem("adlibProDebug") === "1";
  } catch {
    return false;
  }
}

function logInfo(...args: unknown[]): void {
  console.log(LOG_NS, ...args);
}

function logWarn(...args: unknown[]): void {
  console.warn(LOG_NS, ...args);
}

function logError(...args: unknown[]): void {
  console.error(LOG_NS, ...args);
}

function logVerbose(...args: unknown[]): void {
  if (isDebugVerbose()) console.log(LOG_NS, "[verbose]", ...args);
}

function normalizeVisibleText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function isFacebookAdsLibraryPage(): boolean {
  return (
    window.location.hostname === "www.facebook.com" &&
    window.location.pathname.startsWith(ADS_LIBRARY_PATH)
  );
}

function injectStyles(): void {
  if (document.getElementById(STYLE_TAG_ID)) {
    logVerbose("injectStyles: 已存在，跳过");
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = `
    body.adlib-pro-layout div[role="main"] {
      max-width: 1600px !important;
      margin-inline: auto !important;
    }

    body.adlib-pro-layout div[role="main"] > div {
      width: 100% !important;
      max-width: 1600px !important;
    }

    .${TOOLBAR_WRAP_CLASS} {
      width: 100%;
      box-sizing: border-box;
      margin: 6px 0 10px;
    }

    /* 与目标 hr 共用一套 FB utility class，仅用少量覆盖保证里面是横向按钮区而非分割线 */
    .${TOOLBAR_ABOVE_HR_CLASS} {
      display: flex !important;
      flex-direction: column;
      align-items: stretch;
      box-sizing: border-box;
      width: 100%;
      border: none !important;
      height: auto !important;
      min-height: 0 !important;
      background: transparent !important;
    }

    .${TOOLBAR_ABOVE_HR_CLASS} .${ACTIONS_WRAP_CLASS} {
      width: 95%;
      box-sizing: border-box;
    }

    .${ACTIONS_WRAP_CLASS} {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      padding: 2px 2 2px 2px;
    }

    /* 贴近 Ads Library「See ad details / See summary details」次要按钮：白底、细边框、Meta 蓝字 */
    .${ACTION_BUTTON_CLASS} {
      align-items: center;
      justify-content: center;
      display: flex;
      appearance: none;
      -webkit-appearance: none;
      margin: 0;
      box-sizing: border-box;
      border-radius: 6px;
      border: 1px solid #CCD0D5;
      background-color: #FFFFFF;
      color: #216FDB;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3333;
      padding: 5px 20px;
      cursor: pointer;
      box-shadow: none;
      transition: background-color 0.1s ease, border-color 0.1s ease;
    }

    .${ACTION_BUTTON_CLASS}:hover {
      background-color: #F0F2F5;
      border-color: #BEC3C9;
    }

    .${ACTION_BUTTON_CLASS}:active {
      background-color: #E4E6EB;
    }

    .${ACTION_BUTTON_CLASS}:focus {
      outline: none;
    }

    .${ACTION_BUTTON_CLASS}:focus-visible {
      outline: 2px solid #216FDB;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
  logInfo("injectStyles: 已注入样式");
}

function handleToolbarAction(actionKey: string, anchorDiv: HTMLElement): void {
  logInfo("handleToolbarAction", { actionKey, anchorSnippet: anchorDiv.className?.toString?.().slice(0, 80) });
  switch (actionKey) {
    case "download-image":
      window.alert("下载图片（占位）：后续可在此读取当前广告卡片内的图片地址并下载。");
      break;
    case "download-video":
      window.alert("下载视频（占位）：后续可在此读取视频 src 并下载。");
      break;
    case "copy-ad-info": {
      const text = anchorDiv.innerText?.slice(0, 2000) ?? "";
      const p = navigator.clipboard?.writeText(text);
      if (p) {
        void p.then(
          () => window.alert("已复制当前区块部分文本（占位）。"),
          () => window.prompt("复制失败，请手动复制：", text)
        );
      } else {
        window.prompt("请手动复制：", text);
      }
      break;
    }
    default:
      window.alert(`未知动作: ${actionKey}`);
  }
}

function createInlineButton(label: string,actionKey: string, anchorDiv: HTMLElement): HTMLButtonElement {
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

function buildActionsWrap(anchorDiv: HTMLElement): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = ACTIONS_WRAP_CLASS;
  wrap.appendChild(createInlineButton("Open Ad", "download-image", anchorDiv));
  wrap.appendChild(createInlineButton("Open All Ads", "download-video", anchorDiv));
  wrap.appendChild(createInlineButton("Download", "copy-ad-info", anchorDiv));
  return wrap;
}

function findDividerHrElements(): HTMLHRElement[] {
  const exact = Array.from(
    document.querySelectorAll<HTMLHRElement>(AD_DIVIDER_HR_SELECTOR_EXACT)
  );
  if (exact.length > 0) {
    logVerbose("findDividerHrElements: 精确 class 命中", { count: exact.length });
    return exact;
  }
  const loose = Array.from(
    document.querySelectorAll<HTMLHRElement>(AD_DIVIDER_HR_SELECTOR_FALLBACK)
  );
  logVerbose("findDividerHrElements: 使用回退选择器", {
    count: loose.length,
    selector: AD_DIVIDER_HR_SELECTOR_FALLBACK,
  });
  return loose;
}

/** 从 hr 向上找广告卡片范围，供复制/后续抓取用 */
function getAdContextFromHr(hr: HTMLElement): HTMLElement {
  const article = hr.closest<HTMLElement>('[role="article"]');
  if (article) return article;
  let p: HTMLElement | null = hr.parentElement;
  for (let i = 0; i < 8 && p; i += 1) {
    if (p.children.length >= 2) return p;
    p = p.parentElement;
  }
  return hr.parentElement ?? hr;
}

/**
 * 在目标 hr 正上方插入工具栏；外层 div 复制 hr 的 className，继承 FB 版式 token，再用 TOOLBAR_ABOVE_HR_CLASS 覆盖布局。
 */
function injectToolbarAboveHr(hr: HTMLHRElement): boolean {
  const prev = hr.previousElementSibling;
  if (prev?.classList.contains(TOOLBAR_ABOVE_HR_CLASS)) {
    logVerbose("injectToolbarAboveHr: 已存在工具栏，跳过");
    return false;
  }

  const parent = hr.parentElement;
  if (!parent) {
    logWarn("injectToolbarAboveHr: hr 无 parent");
    return false;
  }

  const context = getAdContextFromHr(hr);
  const outer = document.createElement("div");
  const fbClasses = typeof hr.className === "string" ? hr.className.trim() : "";
  outer.className = `${TOOLBAR_ABOVE_HR_CLASS}${fbClasses ? ` ${fbClasses}` : ""}`;
  outer.appendChild(buildActionsWrap(context));

  parent.insertBefore(outer, hr);
  logVerbose("injectToolbarAboveHr: 已在 hr 前插入", {
    fbClassPreview: fbClasses.slice(0, 80),
  });
  return true;
}

const PHRASE_SET = new Set<string>(AD_TEXT_PHRASES);

/**
 * 找出文案完全等于目标短语的元素，并去掉「外层仍整段等于同文案」的祖先，保留最内层匹配节点。
 */
function findMinimalPhraseElements(): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  const selector = 'div, span, a, button, [role="button"]';
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const t = normalizeVisibleText(el.textContent ?? "");
    if (PHRASE_SET.has(t)) candidates.push(el);
  });

  return candidates.filter(
    (el) => !candidates.some((other) => other !== el && el.contains(other))
  );
}

/**
 * 「文本所在的 div」：若匹配节点本身是 div 则用它，否则取最近的 div 祖先。
 */
function resolveAnchorDiv(matchEl: HTMLElement): HTMLElement | null {
  if (matchEl instanceof HTMLDivElement) return matchEl;
  return matchEl.closest("div");
}

/**
 * 在 anchorDiv 的并列位置（作为下一个兄弟节点）插入工具栏 div。
 */
function injectToolbarAsNextSibling(anchorDiv: HTMLElement): boolean {
  const next = anchorDiv.nextElementSibling;
  if (next?.classList.contains(TOOLBAR_WRAP_CLASS)) {
    logVerbose("injectToolbar: 已有兄弟工具栏，跳过", { tag: anchorDiv.tagName });
    return false;
  }

  const parent = anchorDiv.parentElement;
  if (!parent) {
    logWarn("injectToolbar: anchorDiv 无 parent，跳过");
    return false;
  }

  const outer = document.createElement("div");
  outer.className = TOOLBAR_WRAP_CLASS;
  outer.appendChild(buildActionsWrap(anchorDiv));

  parent.insertBefore(outer, anchorDiv.nextSibling);
  logVerbose("injectToolbar: 已在文案 div 后插入兄弟工具栏");
  return true;
}

function addInlineActionsForCard(): void {
  const hrs = findDividerHrElements();
  logVerbose("addInlineActionsForCard: hr 候选", { count: hrs.length });
  if (hrs.length > 0) {
    let newlyInjected = 0;
    for (const hr of hrs) {
      if (injectToolbarAboveHr(hr)) newlyInjected += 1;
    }
    logInfo("addInlineActionsForCard: 扫描完成（hr 分隔线锚点）", {
      hrCount: hrs.length,
      newlyInjected,
    });
    return;
  }

  logWarn("addInlineActionsForCard: 未命中目标 hr，回退到文案锚点", {
    exactSelector: AD_DIVIDER_HR_SELECTOR_EXACT,
  });

  const matches = findMinimalPhraseElements();
  logVerbose("findMinimalPhraseElements", { count: matches.length });

  let newlyInjected = 0;
  let skippedNoDiv = 0;

  for (const el of matches) {
    const anchorDiv = resolveAnchorDiv(el);
    if (!anchorDiv) {
      skippedNoDiv += 1;
      logVerbose("跳过：无法解析为 div", { tag: el.tagName });
      continue;
    }
    if (injectToolbarAsNextSibling(anchorDiv)) newlyInjected += 1;
  }

  logInfo("addInlineActionsForCard: 扫描完成（文本锚点）", {
    phraseMatches: matches.length,
    newlyInjected,
    skippedNoDiv,
  });

  if (matches.length === 0) {
    logWarn("addInlineActionsForCard: 文案锚点也未找到，可能仍在加载、语言不同或 DOM 已变", {
      url: window.location.href,
    });
  }
}

function setupMutationObserver(): void {
  let debounceHandle: number | undefined;
  let pendingScheduleLogged = false;
  const scheduleWork = (): void => {
    if (debounceHandle !== undefined) {
      if (isDebugVerbose() && !pendingScheduleLogged) {
        pendingScheduleLogged = true;
        logVerbose("MutationObserver: DOM 变化，已有待执行扫描，合并到同一防抖窗口");
      }
      return;
    }
    debounceHandle = window.setTimeout(() => {
      debounceHandle = undefined;
      pendingScheduleLogged = false;
      try {
        logVerbose("MutationObserver: 防抖结束，执行扫描");
        addInlineActionsForCard();
      } catch (e) {
        logError("addInlineActionsForCard 异常", e);
      }
    }, 800);
    logVerbose("MutationObserver: 已安排 800ms 后扫描");
  };

  const root =
    document.querySelector<HTMLElement>('div[role="main"]') ?? document.body;

  logInfo("setupMutationObserver: 开始监听", {
    root: root === document.body ? "document.body" : 'div[role="main"]',
    tag: root.tagName,
  });

  const observer = new MutationObserver(() => {
    scheduleWork();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}

function applyLayoutAdjustments(): void {
  document.body.classList.add("adlib-pro-layout");
}

function bootstrap(): void {
  logInfo("bootstrap: 入口", {
    href: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    readyState: document.readyState,
    verbose: isDebugVerbose(),
    hrSelector: AD_DIVIDER_HR_SELECTOR_EXACT,
    phrases: AD_TEXT_PHRASES,
  });

  if (!isFacebookAdsLibraryPage()) {
    logInfo("bootstrap: 非 Ads Library 页面，退出", {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    });
    return;
  }

  if (document.documentElement.hasAttribute(INJECTED_FLAG_ATTR)) {
    logWarn("bootstrap: 已注入过（data-adlib-pro-injected），跳过重复 bootstrap");
    return;
  }
  //设置已注入标志
  document.documentElement.setAttribute(INJECTED_FLAG_ATTR, "true");

  injectStyles();

  applyLayoutAdjustments();
  addInlineActionsForCard();
  setupMutationObserver();

  logInfo("bootstrap: 完成初始化。详细日志: localStorage.setItem('adlibProDebug','1') 后刷新");
}

if (document.readyState === "loading") {
  logVerbose("等待 DOMContentLoaded 后 bootstrap");
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  logVerbose("document 已就绪，立即 bootstrap");
  bootstrap();
}
