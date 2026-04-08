import "./style.css";

interface AdInfo {
  ad_archive_id: string;
  page_name?: string;
  page_id?: string;
  link_url?:string;
  caption?: string;
  cta_text?: string;
  page_like_count?: number;
  start_date?: number; // unix timestamp
}

/** ad_archive_id → AdInfo */
const adInfoStore = new Map<string, AdInfo>();

const AD_INFO_PANEL_CLASS = "adlib-pro-info-panel";

/**
 * 从已加载的 HTML 中解析所有 <script type="application/json" data-sjs> 标签，
 * 提取首屏广告数据（Relay 服务端预加载，不经过 fetch）。/html/body/script[55]
 */
function parseInlineScriptData(): void {
  document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]').forEach((el) => {
    try {
      const json = JSON.parse(el.textContent ?? "");
      const ads: AdInfo[] = [];
      walkForAdLibraryMain(json, ads);
      if (ads.length > 0) {
        for (const ad of ads) adInfoStore.set(ad.ad_archive_id, ad);
        // logInfo("parseInlineScriptData: 解析到广告数据", ads);
      }
    } catch (_) { /* 非 JSON 的 script 标签，忽略 */ }
  });
}

/**
 * 解析 body > script:nth-child(61) 的内容并输出到控制台。
 * body > script:nth-child(61)//*[@id="facebook"]/body/script[55]
 * //*[@id="facebook"]/body/script[55]
 */
function parseAndLogScriptNthChild(): void {
  const el = document.querySelector<HTMLScriptElement>("#facebook > body > script:nth-of-type(55)");
  if (!el) {
    return;
  }
  const raw = el.textContent ?? "";
  try {
    const json = JSON.parse(raw);
    //遍历json，要从最外层，找到最内层，递归调用 找到 ad_library_main，并打印出来
    const ads: AdInfo[] = [];
    walkForAdLibraryMain(json,ads);
    if (ads.length > 0) {
      for (const ad of ads) adInfoStore.set(ad.ad_archive_id, ad);
    }
  } catch (_) {
  }
}

function walkForAdLibraryMain(node: unknown, ads: AdInfo[], depth = 0): void {

  if (!node || typeof node !== "object" || depth > 12) return;
  const obj = node as Record<string, unknown>;

  // 直接命中
  if (obj.ad_library_main) {
    extractEdges(obj.ad_library_main, ads);
    return;
  }

  // Relay __bbox 结构
  if (obj.__bbox) {
    walkForAdLibraryMain(obj.__bbox, ads, depth + 1);
    return;
  }

  // result.data 路径
  if (obj.result) walkForAdLibraryMain(obj.result, ads, depth + 1);
  if (obj.data) walkForAdLibraryMain(obj.data, ads, depth + 1);
  if (obj.require) walkForAdLibraryMain(obj.require, ads, depth + 1);
  
  // require 数组（ScheduledServerJS 格式）
  if (Array.isArray(obj)) {
    for (const item of obj) {
        walkForAdLibraryMain(item, ads, depth + 1);
    }
  }
}

/** 从 ad_library_main 提取所有广告并推入 ads 数组 */
function extractEdges(main: unknown, ads: AdInfo[]): void {

  if (!main || typeof main !== "object") return;
  const m = main as Record<string, unknown>;
  const conn = m.search_results_connection as Record<string, unknown> | undefined;
  if (!conn) return;

  const edges = (conn.edges as unknown[]) ?? [];

  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue;
    const node = ((edge as Record<string, unknown>).node ?? {}) as Record<string, unknown>;
    const collated = (node.collated_results as unknown[]) ?? [];
    for (const item of collated) {
      pushAd(item, ads);
    }
    // node 本身也可能有 ad_archive_id（非 collated 情况）
    if (node.ad_archive_id) pushAd(node, ads);
  }
}

/** 从单个广告节点提取字段并推入 ads */
function pushAd(item: unknown, ads: AdInfo[]): void {
  if (!item || typeof item !== "object") return;
  const s = item as Record<string, unknown>;
  const id = s.ad_archive_id;
  if (!id) return;
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  const body = (snap.body ?? {}) as Record<string, unknown>;
  ads.push({
    ad_archive_id: String(id),
    page_name: (s.page_name ?? snap.page_name ?? null) as string | undefined,
    caption: (body.text ?? snap.caption ?? null) as string | undefined,
    cta_text: (snap.cta_text ?? null) as string | undefined,
    page_id: (s.page_id ?? snap.page_id ?? null) as string | undefined,  
    link_url:(s.link_url ?? snap.link_url ?? null) as string | undefined,  
    // page_like_count 在 snapshot 里
    page_like_count: (snap.page_like_count ?? null) as number | undefined,
    start_date: (s.start_date ?? null) as number | undefined,
  });
}

/** 格式化 Unix 时间戳为 YYYY-MM-DD */
function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}
/** 计算 Unix 时间戳距离今天的天数（正数表示未来，负数表示过去） */
function getDaysFromToday(ts: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 设置为今天的0点
  
  const targetDate = new Date(ts * 1000);
  targetDate.setHours(0, 0, 0, 0); // 设置为目标日期的0点
  
  const timeDiff = today.getTime() - targetDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  if(daysDiff<=1) return 1;
  return daysDiff;
}

/** 构建信息面板 DOM */
function buildInfoPanel(ad: AdInfo): HTMLDivElement {

  const panel = document.createElement("div");
  panel.className = AD_INFO_PANEL_CLASS;

  const rows: Array<[string, string]> = [];
  // if (ad.page_name) rows.push(["Page", ad.page_name]);
  if (ad.page_like_count != null) rows.push(["Likes:", ad.page_like_count.toLocaleString()]);
  if (ad.start_date != null) rows.push(["Started:", formatDate(ad.start_date) + " (Active "+ getDaysFromToday(ad.start_date)+" days)"]);
  if (ad.cta_text) rows.push(["CTA:", ad.cta_text]);
  // 对 ad.link_url. 进行解析,仅仅返回域名就可以了
  if (ad.link_url) {
    try {
      const url = new URL(ad.link_url);
      rows.push(["Link:", url.hostname]);
    } catch {
      // ignore invalid URL errors, do not add domain row
    }
  }
 
  panel.innerHTML = rows
    .map(([k, v]) => `<span class="adlib-pro-info-key">${k}</span><span class="adlib-pro-info-val">${escapeHtml(v)}</span>`)
    .join("");
  return panel;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 更新或插入某个工具栏容器内的信息面板 */
function updateInfoPanelInToolbar(toolbarOuter: HTMLElement,ad:AdInfo|null): void {
  const adId = toolbarOuter.getAttribute("data-ad-id");
  if (!adId) return;
  let panel = toolbarOuter.querySelector<HTMLDivElement>(`.${AD_INFO_PANEL_CLASS}`);
  if (!ad) return; // 数据还没到，等下次刷新
  if (!panel) {
    // 这个是panel还没有的时候
    panel = buildInfoPanel(ad);
    toolbarOuter.appendChild(panel);
  } else {
    //有panel的时候，则替换
    const fresh = buildInfoPanel(ad);
    panel.replaceWith(fresh);
  }
}

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

function isDebugVerbose(): boolean {
  try {
    return window.localStorage.getItem("adlibProDebug") === "1";
  } catch {
    return false;
  }
}

function isFacebookAdsLibraryPage(): boolean {
  return (
    window.location.hostname === "www.facebook.com" &&
    window.location.pathname.startsWith(ADS_LIBRARY_PATH)
  );
}

function injectStyles(): void {
  if (document.getElementById(STYLE_TAG_ID)) return;

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

    .${TOOLBAR_ABOVE_HR_CLASS} {
      display: flex !important;
      flex-direction: column;
      align-items: stretch;
      box-sizing: border-box;
      width: 100%;
      border: none !important;
      height: auto !important;
      padding: 1px 1px 1px 10px;
      min-height: 0 !important;
      background: transparent !important;
    }

    .${TOOLBAR_ABOVE_HR_CLASS} .${ACTIONS_WRAP_CLASS} {
      width: 100%;
      box-sizing: border-box;
      padding: 1px 1px 2px 5px;
    }

    .${ACTIONS_WRAP_CLASS} {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
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

    .${AD_INFO_PANEL_CLASS} {
      display: grid;
      grid-template-columns: 1fr 3fr 1fr 5fr;
      column-gap: 5px;
      row-gap: 1px;
      width: 100%;
      box-sizing: border-box;
      padding: 2px 2px 2px 10px;
      font-family: inherit;
      font-size: 12px;
      line-height: 1.4;
    }

    .adlib-pro-info-key {
      color: #216FDB;
      font-weight: 600;
      white-space: nowrap;
    }

    .adlib-pro-info-val {
      color: #1C1E21;
      word-break: break-word;
    }
  `;
  document.head.appendChild(style);
  console.log("injectStyles: 已注入样式");
}

/** 从广告卡片上下文提取所有图片/视频 URL */
function extractMediaUrls(context: HTMLElement): { images: string[]; videos: string[] } {
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
    //过滤掉头像照片
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

/** 从广告卡片找到"See ad details"链接或最近的 <a> 指向广告详情页 */
function findAdDetailUrl(context: HTMLElement): string | null {
    // 1. 获取当前完整 URL
  const adlibarayId = findAdLibraryIdByAttr(context);

  const adsinfo = adInfoStore.get(adlibarayId)
  // 关键：广告信息不存在时直接返回 null（避免后续报错）
  if (!adsinfo) return null;

  // 3. 生成新 URL（不跳转）
  const newUrl = createUrlWithNewParams({
    view_all_page_id: adsinfo?.page_id ?? '',
    country:"ALL",
    search_type:"page"
  });
  return newUrl;  
}
/**
 * 获取当前页面完整 URL
 */
export const getFullUrl = (): string => {
  return window.location.href;
};

/**
 * 解析 URL 参数，返回键值对对象
 */
export const parseUrlParams = (): Record<string, string> => {
  const params = new URLSearchParams(window.location.search);
  const paramObj: Record<string, string> = {};
  
  for (const [key, value] of params.entries()) {
    paramObj[key] = value;
  }
  
  return paramObj;
};

/**
 * 替换/新增 URL 参数，并返回新 URL
 * @param newParams 要覆盖的参数
 */
export const createUrlWithNewParams = (newParams: Record<string, string | number | boolean>): string => {
  // 基础路径（协议 + 域名 + 路径）
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const searchParams = new URLSearchParams(window.location.search);

  // 覆盖参数
  Object.entries(newParams).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  // 拼接最终 URL
  return `${baseUrl}?${searchParams.toString()}`;
};

/**
 * 替换参数并直接跳转页面
 * @param newParams 要覆盖的参数
 * @param replaceHistory 是否替换历史记录（默认 false）
 */
export const redirectWithNewParams = (
  newParams: Record<string, string | number | boolean>,
  replaceHistory = false
): void => {
  const newUrl = createUrlWithNewParams(newParams);
  
  if (replaceHistory) {
    window.location.replace(newUrl);
  } else {
    window.location.href = newUrl;
  }
};

/** 通过 background script 下载单个文件 */
function downloadViaBackground(url: string, filename: string): void {
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

/** 生成文件名（从 URL 提取，必要时加序号和时间戳） */
function buildFilename(url: string, index: number, ext?: string): string {
  try {
    const u = new URL(url);
    // 取路径最后一段，去掉查询参数
    const base = u.pathname.split("/").filter(Boolean).pop() ?? `media_${index}`;
    // 保留原始扩展名，或强制指定的 ext
    const dotIdx = base.lastIndexOf(".");
    const name = dotIdx > 0 ? base.slice(0, dotIdx) : base;
    const extension = ext ?? (dotIdx > 0 ? base.slice(dotIdx + 1) : "jpg");
    return `adlib-pro/${Date.now()}_${index}_${name}.${extension}`;
  } catch {
    return `adlib-pro/${Date.now()}_${index}.${ext ?? "jpg"}`;
  }
}

//界面上添加按钮
function buildActionsWrap(anchorDiv: HTMLElement): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = ACTIONS_WRAP_CLASS;
  wrap.appendChild(createInlineButton("Open Page Ads", "open-page-ads", anchorDiv));
  wrap.appendChild(createInlineButton("Open Link Ads", "open-link-ads", anchorDiv));
  wrap.appendChild(createInlineButton("Download", "download", anchorDiv));
  return wrap;
}

// 界面上添加按钮对应的事件
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

// 实现key对应的事件
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
      }else{
        window.alert("当前页面未找到任何广告链接，请等待页面加载完成后重试。");
        break;
      }
      break;
    }

    case "download": {
      const { images, videos } = extractMediaUrls(anchorDiv);
      if (images.length === 0 && videos.length === 0) {
        window.alert("当前广告卡片中未找到可下载的图片或视频，请等待媒体加载完成后重试。");
        break;
      }

      // 视频优先下载
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

function openLinkAdsUrl(context: HTMLElement): string | null {
    // 1. 获取当前完整 URL
    const adlibarayId = findAdLibraryIdByAttr(context);
    const adsinfo = adInfoStore.get(adlibarayId)
    // 关键：广告信息不存在时直接返回 null（避免后续报错）
    if (!adsinfo) {
      return null;
    }
    // 3. 生成新 URL（不跳转）
    const newUrl = createUrlWithNewParams({
      q: getHostname(adsinfo?.link_url)
    });
    return newUrl;  
}

// 安全获取 URL 的 hostname，不会抛错
function getHostname(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname || '';
  } catch {
    return '';
  }
}

function findDividerHrElements(): HTMLHRElement[] {
  const exact = Array.from(
    document.querySelectorAll<HTMLHRElement>(AD_DIVIDER_HR_SELECTOR_EXACT)
  );
  return exact;
}

/** 从 hr 向上找广告卡片范围，供复制/后续抓取用 */
function getAdContextFromHr(hr: HTMLElement): HTMLElement {
  let p: HTMLElement | null = hr.parentElement;
  for (let i = 0; i < 8 && p; i += 1) {
    if (p.children.length >= 2) return p;
    p = p.parentElement;
  }
  return hr.parentElement ?? hr;
}

function findAdLibraryIdByAttr(context: HTMLElement): string {
  // 遍历当前元素的所有直接子元素
  for (let i = 0; i < context.children.length; i++) {
    const child = context.children[i];
    // 检查子元素是否包含 data-ad-id 属性
    if (child.hasAttribute("data-ad-id")) {
      // 获取并去除首尾空格，保证返回值不为 undefined
      return child.getAttribute("data-ad-id")?.trim() || "";
    }
  }
  // 遍历完所有子元素都未找到，返回空字符串
  return "";
}

function findAdLibraryId(hr:HTMLElement,element:HTMLElement,q:string): void {
  
    if (!element) {
      return;
    }

    if(element.children.length>0){
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        findAdLibraryId(hr,child as HTMLElement, q);
      }
    }else{
      const textContent = element.textContent?.trim();
      // 检查文本是否符合"Library ID: 数字"的格式
      if (textContent && textContent.startsWith(q)) {
        // 提取ID部分
        const parts = textContent.split(":");
        if (parts.length >= 2) {
          const adId = parts[1]?.trim(); // 直接返回冒号后的部分
          const parent = hr.parentElement??null;
          if(parent){
            // document.querySelector<HTMLElement>('div[data-ad-id="${adId}"]')
            const adElement = parent.querySelector<HTMLElement>(`div[data-ad-id="${adId}"]`);
            // 找到了对应元素,则不进行后续的处理逻辑
            if (adElement) return;
          }
          const outer = document.createElement("div");
          outer.className = `${TOOLBAR_ABOVE_HR_CLASS}`;

          const context = getAdContextFromHr(hr);
          // 这里是他父类的元素，添加按钮信息
          if (adId) outer.setAttribute("data-ad-id", adId);
          outer.appendChild(buildActionsWrap(context));
          if(parent) parent.insertBefore(outer, hr);
          //添加描述信息
          const adinfo:AdInfo|null =  adInfoStore.get(adId)??null;
          if(adId) updateInfoPanelInToolbar(outer,adinfo);
          return;
        }
      }
    }
}

/**
 * 在目标 hr 正上方插入工具栏；外层 div 复制 hr 的 className，继承 FB 版式 token，再用 TOOLBAR_ABOVE_HR_CLASS 覆盖布局。
 */
function injectToolbarAboveHr(hr: HTMLHRElement): boolean {
  
  const prev = hr.previousElementSibling;
  if (prev?.classList.contains(TOOLBAR_ABOVE_HR_CLASS)) {
    return false;
  }

  const parent = hr.parentElement;
  if (!parent) return false;

  const context = getAdContextFromHr(hr);
  findAdLibraryId(hr,context,"Library ID:");
  return true;
}

function addInlineActionsForCard(): void {
  const hrs = findDividerHrElements();
  if (hrs.length > 0) {
    let newlyInjected = 0;
    for (const hr of hrs) {
      if (injectToolbarAboveHr(hr)) newlyInjected += 1;
    }
    return;
  }
}

function setupMutationObserver(): void {
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

  const root =
    document.querySelector<HTMLElement>('div[role="main"]') ?? document.body;

  const observer = new MutationObserver(() => {
    scheduleWork();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}

function bootstrap(): void {

  if (!isFacebookAdsLibraryPage()) return;

  if (document.documentElement.hasAttribute(INJECTED_FLAG_ATTR)) return;
  
  //设置已注入标志
  document.documentElement.setAttribute(INJECTED_FLAG_ATTR, "true");

  injectStyles();

  // 解析首屏内联 script JSON 数据（首次加载时数据嵌在 HTML 里，不经过 fetch）
  // 然后解析里面的数据，放到缓存中备用，这里解析有两种方法，目前使用的是第二种
  parseInlineScriptData();
  
  //首屏数据已就绪，立即填充信息面板
  setupMutationObserver();

  console.log("bootstrap: 完成初始化。");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
