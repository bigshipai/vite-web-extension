console.log("background script loaded");

type DownloadMediaMsg = {
  type: "DOWNLOAD_MEDIA";
  url: string;
  filename: string;
};

type OpenTabMsg = {
  type: "OPEN_TAB";
  url: string;
};

type OpenTabsMsg = {
  type: "OPEN_TABS";
  urls: string[];
};

type Msg = DownloadMediaMsg | OpenTabMsg | OpenTabsMsg;

// 监听扩展更新事件，自动重新加载匹配的标签页
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    console.log('[AdLib Pro] Extension updated, reloading matching tabs...');

    // 查询所有匹配 Facebook Ads Library 的标签页
    chrome.tabs.query({
      url: 'https://www.facebook.com/ads/library*'
    }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          // 重新加载标签页以应用新的 content script
          chrome.tabs.reload(tab.id);
          console.log(`[AdLib Pro] Reloaded tab ${tab.id}: ${tab.url}`);
        }
      });
    });
  } else if (details.reason === 'install') {
    console.log('[AdLib Pro] Extension installed successfully');
  }
});

chrome.runtime.onMessage.addListener(
  (message: Msg, _sender, sendResponse) => {
    if (message.type === "DOWNLOAD_MEDIA") {
      chrome.downloads.download(
        { url: message.url, filename: message.filename, saveAs: false },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error("[AdLib Pro BG] download error", chrome.runtime.lastError.message);
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ ok: true, downloadId });
          }
        }
      );
      return true; // keep channel open for async sendResponse
    }

    if (message.type === "OPEN_TAB") {
      chrome.tabs.create({ url: message.url, active: true });
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "OPEN_TABS") {
      for (const url of message.urls) {
        chrome.tabs.create({ url, active: false });
      }
      sendResponse({ ok: true });
      return false;
    }
  }
);
