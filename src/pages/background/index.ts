console.log("background auth script loaded");

export {};

const CONTACT_SUPPORT_MESSAGE =
  "Your trial limit has been reached. Please contact customer support to upgrade to Pro.";

const DAY_MS = 24 * 60 * 60 * 1000;

type MembershipTier = "FreeTrial" | "Pro";

type UsageStats = {
  downloadCount: number;
  openPageAdsCount: number;
  openLinkAdsCount: number;
};

type ActiveProfile = {
  token: string;
  email?: string;
  membership: MembershipTier;
  usage: UsageStats;
  createdAt: number;
  expiresAt: number;
  trialMaxOps: number;
};

type LicenseInfo = {
  licenseKey: string;
  planName: string;
  status: "active" | "inactive";
  createdAt: number;
  expiresAt: number;
};

type LicenseValidationResult = {
  ok: boolean;
  message?: string;
  license?: LicenseInfo;
};

type DownloadMediaMsg = {
  type: "DOWNLOAD_MEDIA";
  url: string;
  filename: string;
  opType?: OpType;
};

type DownloadBatchItem = { url: string; filename: string };

type DownloadMediaBatchMsg = {
  type: "DOWNLOAD_MEDIA_BATCH";
  items: DownloadBatchItem[];
  opType?: OpType;
};

type OpenTabMsg = {
  type: "OPEN_TAB";
  url: string;
  opType?: OpType;
};

type OpenTabsMsg = {
  type: "OPEN_TABS";
  urls: string[];
  opType?: OpType;
};

type GetLicenseInfoMsg = {
  type: "GET_LICENSE_INFO";
};

type ValidateLicenseMsg = {
  type: "VALIDATE_LICENSE";
};

type SetLicenseKeyMsg = {
  type: "SET_LICENSE_KEY";
  licenseKey: string;
};

type LoginMsg = {
  type: "LOGIN";
  email: string;
  password: string;
};

type GetProfileMsg = {
  type: "GET_PROFILE";
};

type LogoutMsg = {
  type: "LOGOUT";
};

type OpType = "DOWNLOAD_MEDIA" | "OPEN_PAGE_ADS" | "OPEN_LINK_ADS";

type Msg =
  | DownloadMediaMsg
  | DownloadMediaBatchMsg
  | OpenTabMsg
  | OpenTabsMsg
  | GetLicenseInfoMsg
  | ValidateLicenseMsg
  | SetLicenseKeyMsg
  | LoginMsg
  | GetProfileMsg
  | LogoutMsg;

type LoginResponse = { ok: true; profile: ActiveProfile } | { ok: false; message: string };

const STORAGE_USERS_KEY = "adlib_pro_users_v1";
const STORAGE_GUEST_PROFILE_KEY = "adlib_pro_guest_profile_v1";
const STORAGE_ACTIVE_PROFILE_KEY = "adlib_pro_active_profile_v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function generateToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ADLIB-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
  }
  const fallback = Math.random().toString(36).slice(2).toUpperCase();
  return `ADLIB-${Date.now().toString(36).toUpperCase()}-${fallback}`;
}

function emptyUsage(): UsageStats {
  return { downloadCount: 0, openPageAdsCount: 0, openLinkAdsCount: 0 };
}

function createFreeTrialProfile(email?: string): ActiveProfile {
  const now = Date.now();
  return {
    token: generateToken(),
    email,
    membership: "FreeTrial",
    usage: emptyUsage(),
    createdAt: now,
    expiresAt: now + DAY_MS * 365,
    trialMaxOps: 10,
  };
}

function createProProfile(email?: string): ActiveProfile {
  const now = Date.now();
  return {
    token: generateToken(),
    email,
    membership: "Pro",
    usage: emptyUsage(),
    createdAt: now,
    expiresAt: now + DAY_MS * 3650,
    trialMaxOps: 10,
  };
}

function getTotalOps(usage: UsageStats): number {
  return usage.downloadCount + usage.openPageAdsCount + usage.openLinkAdsCount;
}

function profileToLicenseInfo(profile: ActiveProfile): LicenseInfo {
  const membershipActive =
    profile.membership === "Pro" ? true : getTotalOps(profile.usage) < profile.trialMaxOps;
  return {
    licenseKey: profile.token,
    planName: profile.membership === "Pro" ? "Pro" : "Free Trial",
    status: membershipActive ? "active" : "inactive",
    createdAt: profile.createdAt,
    expiresAt: profile.expiresAt,
  };
}

function getDemoProIfNeeded(_email: string, password: string): MembershipTier {
  if (password.trim().toLowerCase() === "pro") return "Pro";
  return "FreeTrial";
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

async function ensureGuestProfile(): Promise<ActiveProfile> {
  const guest = await getStorage<ActiveProfile>(STORAGE_GUEST_PROFILE_KEY);
  if (guest) return guest;
  const created = createFreeTrialProfile(undefined);
  await setStorage(STORAGE_GUEST_PROFILE_KEY, created);
  return created;
}

async function ensureActiveProfile(): Promise<ActiveProfile> {
  const active = await getStorage<ActiveProfile>(STORAGE_ACTIVE_PROFILE_KEY);
  if (active) return active;
  const guest = await ensureGuestProfile();
  await setStorage(STORAGE_ACTIVE_PROFILE_KEY, guest);
  return guest;
}

type UsersRecord = Record<
  string,
  {
    passwordHash: string;
    profile: ActiveProfile;
  }
>;

async function getUsers(): Promise<UsersRecord> {
  return (await getStorage<UsersRecord>(STORAGE_USERS_KEY)) ?? {};
}

async function setUsers(users: UsersRecord): Promise<void> {
  await setStorage(STORAGE_USERS_KEY, users);
}

async function setActiveProfile(profile: ActiveProfile): Promise<void> {
  await setStorage(STORAGE_ACTIVE_PROFILE_KEY, profile);
}

async function validateLicenseForOperation(profile: ActiveProfile): Promise<LicenseValidationResult> {
  const license = profileToLicenseInfo(profile);
  const ok = license.status === "active";
  if (!ok) return { ok: false, message: CONTACT_SUPPORT_MESSAGE, license };
  return { ok: true, license };
}

async function trackOperation(opType: OpType): Promise<{
  allowed: boolean;
  profile: ActiveProfile;
  license?: LicenseInfo;
  message?: string;
}> {
  const profile = await ensureActiveProfile();
  const validation = await validateLicenseForOperation(profile);
  if (!validation.ok || !validation.license) {
    return { allowed: false, profile, license: validation.license, message: validation.message };
  }

  const next: ActiveProfile = {
    ...profile,
    usage: { ...profile.usage },
  };

  if (opType === "DOWNLOAD_MEDIA") next.usage.downloadCount += 1;
  if (opType === "OPEN_PAGE_ADS") next.usage.openPageAdsCount += 1;
  if (opType === "OPEN_LINK_ADS") next.usage.openLinkAdsCount += 1;

  await setActiveProfile(next);

  if (next.email) {
    const users = await getUsers();
    if (users[next.email]) {
      users[next.email].profile = next;
      await setUsers(users);
    }
  }

  return { allowed: true, profile: next, license: profileToLicenseInfo(next) };
}

function resolveOpType(opType: OpType | undefined, fallback: OpType): OpType {
  return opType ?? fallback;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    ensureActiveProfile().catch(() => {
      // ignore
    });
  }
});

chrome.runtime.onMessage.addListener((message: Msg, _sender, sendResponse) => {
  if (message.type === "LOGOUT") {
    ensureGuestProfile()
      .then(async (guest) => {
        await setActiveProfile(guest);
        sendResponse({ ok: true, profile: guest });
      })
      .catch((e) => sendResponse({ ok: false, message: String(e) }));
    return true;
  }

  if (message.type === "GET_PROFILE") {
    ensureActiveProfile()
      .then((profile) => sendResponse({ ok: true, profile }))
      .catch((e) => sendResponse({ ok: false, message: String(e) }));
    return true;
  }

  if (message.type === "LOGIN") {
    const email = normalizeEmail(message.email);
    const password = message.password ?? "";
    if (!email || password.length < 4) {
      sendResponse({ ok: false, message: "Please enter a valid email and password." } as LoginResponse);
      return false;
    }

    getUsers()
      .then(async (users) => {
        if (!users[email]) {
          const membership = getDemoProIfNeeded(email, password);
          const profile = membership === "Pro" ? createProProfile(email) : createFreeTrialProfile(email);
          users[email] = { passwordHash: hashPassword(password), profile };
          await setUsers(users);
          await setActiveProfile(profile);
          sendResponse({ ok: true, profile } as LoginResponse);
          return;
        }

        const expectedHash = users[email].passwordHash;
        const incomingHash = hashPassword(password);
        if (expectedHash !== incomingHash) {
          sendResponse({ ok: false, message: "Invalid email or password." } as LoginResponse);
          return;
        }

        const profile = users[email].profile;
        await setActiveProfile(profile);
        sendResponse({ ok: true, profile } as LoginResponse);
      })
      .catch((e) => {
        sendResponse({ ok: false, message: String(e) } as LoginResponse);
      });
    return true;
  }

  if (message.type === "SET_LICENSE_KEY") {
    const nextMembership: MembershipTier =
      message.licenseKey.trim().toLowerCase().includes("pro") ? "Pro" : "FreeTrial";
    const profile =
      nextMembership === "Pro" ? createProProfile(undefined) : createFreeTrialProfile(undefined);
    const nextProfile: ActiveProfile = { ...profile, token: message.licenseKey.trim() };

    setActiveProfile(nextProfile)
      .then(() => {
        sendResponse({ ok: true, license: profileToLicenseInfo(nextProfile) });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: String(e) });
      });
    return true;
  }

  if (message.type === "GET_LICENSE_INFO") {
    ensureActiveProfile()
      .then((profile) => sendResponse({ ok: true, license: profileToLicenseInfo(profile) }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (message.type === "VALIDATE_LICENSE") {
    ensureActiveProfile()
      .then((profile) => validateLicenseForOperation(profile))
      .then((res) => sendResponse(res))
      .catch(() => sendResponse({ ok: false, message: CONTACT_SUPPORT_MESSAGE }));
    return true;
  }

  if (message.type === "DOWNLOAD_MEDIA") {
    const opType = resolveOpType(message.opType, "DOWNLOAD_MEDIA");
    trackOperation(opType)
      .then((res) => {
        if (!res.allowed) {
          sendResponse({
            ok: false,
            error: "LIMIT_REACHED",
            message: res.message ?? CONTACT_SUPPORT_MESSAGE,
          });
          return;
        }
        chrome.downloads.download(
          { url: message.url, filename: message.filename, saveAs: false },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse({ ok: true, downloadId });
          },
        );
      })
      .catch(() => sendResponse({ ok: false, error: "UNKNOWN_ERROR" }));
    return true;
  }

  if (message.type === "DOWNLOAD_MEDIA_BATCH") {
    const opType = resolveOpType(message.opType, "DOWNLOAD_MEDIA");
    trackOperation(opType)
      .then((res) => {
        if (!res.allowed) {
          sendResponse({
            ok: false,
            error: "LIMIT_REACHED",
            message: res.message ?? CONTACT_SUPPORT_MESSAGE,
          });
          return;
        }

        for (const item of message.items) {
          chrome.downloads.download({ url: item.url, filename: item.filename, saveAs: false });
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false, error: "UNKNOWN_ERROR" }));
    return true;
  }

  if (message.type === "OPEN_TAB") {
    const opType = resolveOpType(message.opType, "OPEN_PAGE_ADS");
    trackOperation(opType)
      .then((res) => {
        if (!res.allowed) {
          sendResponse({ ok: false, error: "LIMIT_REACHED", message: res.message ?? CONTACT_SUPPORT_MESSAGE });
          return;
        }
        chrome.tabs.create({ url: message.url, active: true });
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false, error: "UNKNOWN_ERROR" }));
    return true;
  }

  if (message.type === "OPEN_TABS") {
    const opType = resolveOpType(message.opType, "OPEN_PAGE_ADS");
    trackOperation(opType)
      .then((res) => {
        if (!res.allowed) {
          sendResponse({ ok: false, error: "LIMIT_REACHED", message: res.message ?? CONTACT_SUPPORT_MESSAGE });
          return;
        }
        for (const url of message.urls) {
          chrome.tabs.create({ url, active: false });
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false, error: "UNKNOWN_ERROR" }));
    return true;
  }
});
