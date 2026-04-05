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
