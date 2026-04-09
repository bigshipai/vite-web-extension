console.log("background script loaded");

const LICENSE_STORAGE_KEY = "adlib_pro_license";
const CONTACT_SUPPORT_MESSAGE = "Your key is invalid. Please contact customer support to renew your plan.";
const DAY_MS = 24 * 60 * 60 * 1000;

interface LicenseInfo {
  licenseKey: string;
  planName: string;
  status: "active" | "inactive";
  createdAt: number;
  expiresAt: number;
}

interface LicenseValidationResult {
  ok: boolean;
  message?: string;
  license?: LicenseInfo;
}

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

type GetLicenseInfoMsg = {
  type: "GET_LICENSE_INFO";
};

type ValidateLicenseMsg = {
  type: "VALIDATE_LICENSE";
};

type Msg = DownloadMediaMsg | OpenTabMsg | OpenTabsMsg | GetLicenseInfoMsg | ValidateLicenseMsg;

function generateLicenseKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ADLIB-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
  }
  const fallback = Math.random().toString(36).slice(2).toUpperCase();
  return `ADLIB-${Date.now().toString(36).toUpperCase()}-${fallback}`;
}

function getDefaultLicenseInfo(): LicenseInfo {
  // Demo fallback payload. Replace this with a real backend API response when ready.
  const demoPayload = getDemoLicensePayload();
  return demoPayload;
}

function getDemoLicensePayload(): LicenseInfo {
  const now = Date.now();
  return {
    licenseKey: generateLicenseKey(),
    planName: "Trial Plan",
    status: "active",
    createdAt: now - DAY_MS * 7,
    expiresAt: now - DAY_MS * 1,
  };
}

function getStorage<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function setStorage<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

async function getOrCreateLicenseInfo(): Promise<LicenseInfo> {
  const saved = await getStorage<LicenseInfo>(LICENSE_STORAGE_KEY);
  if (saved) return saved;

  const created = getDefaultLicenseInfo();
  await setStorage(LICENSE_STORAGE_KEY, created);
  return created;
}

async function validateLicense(): Promise<LicenseValidationResult> {
  const license = await getOrCreateLicenseInfo();
  const now = Date.now();
  const isValid = license.status === "active" && license.expiresAt > now;
  if (!isValid) {
    return { ok: false, message: CONTACT_SUPPORT_MESSAGE, license };
  }
  return { ok: true, license };
}

// 监听扩展更新事件，自动重新加载匹配的标签页
chrome.runtime.onInstalled.addListener((details) => {
  getOrCreateLicenseInfo()
    .then((license) => {
      console.log(`[AdLib Pro] License initialized: ${license.licenseKey}`);
    })
    .catch((error) => {
      console.error("[AdLib Pro] Failed to initialize license", error);
    });

  if (details.reason === "update") {
    console.log("[AdLib Pro] Extension updated, reloading matching tabs...");

    // 查询所有匹配 Facebook Ads Library 的标签页
    chrome.tabs.query(
      {
        url: "https://www.facebook.com/ads/library*",
      },
      (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          // 重新加载标签页以应用新的 content script
          chrome.tabs.reload(tab.id);
          console.log(`[AdLib Pro] Reloaded tab ${tab.id}: ${tab.url}`);
        }
      });
      }
    );
  } else if (details.reason === "install") {
    console.log("[AdLib Pro] Extension installed successfully");
  }
});

chrome.runtime.onMessage.addListener(
  (message: Msg, _sender, sendResponse) => {
    if (message.type === "GET_LICENSE_INFO") {
      getOrCreateLicenseInfo()
        .then((license) => {
          sendResponse({ ok: true, license });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: String(error) });
        });
      return true;
    }

    if (message.type === "VALIDATE_LICENSE") {
      validateLicense()
        .then((validation) => {
          sendResponse(validation);
        })
        .catch(() => {
          sendResponse({ ok: false, message: CONTACT_SUPPORT_MESSAGE });
        });
      return true;
    }

    if (message.type === "DOWNLOAD_MEDIA") {
      validateLicense()
        .then((validation) => {
          if (!validation.ok) {
            sendResponse({ ok: false, error: "KEY_INVALID", message: validation.message });
            return;
          }

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
        })
        .catch(() => {
          sendResponse({ ok: false, error: "KEY_INVALID", message: CONTACT_SUPPORT_MESSAGE });
        });
      return true; // keep channel open for async sendResponse
    }

    if (message.type === "OPEN_TAB") {
      validateLicense()
        .then((validation) => {
          if (!validation.ok) {
            sendResponse({ ok: false, error: "KEY_INVALID", message: validation.message });
            return;
          }

          chrome.tabs.create({ url: message.url, active: true });
          sendResponse({ ok: true });
        })
        .catch(() => {
          sendResponse({ ok: false, error: "KEY_INVALID", message: CONTACT_SUPPORT_MESSAGE });
        });
      return true;
    }

    if (message.type === "OPEN_TABS") {
      validateLicense()
        .then((validation) => {
          if (!validation.ok) {
            sendResponse({ ok: false, error: "KEY_INVALID", message: validation.message });
            return;
          }

          for (const url of message.urls) {
            chrome.tabs.create({ url, active: false });
          }
          sendResponse({ ok: true });
        })
        .catch(() => {
          sendResponse({ ok: false, error: "KEY_INVALID", message: CONTACT_SUPPORT_MESSAGE });
        });
      return true;
    }
  }
);
