import React, { useEffect, useMemo, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import logoNoBg from "@assets/img/logo-no-bg.png";

type MembershipTier = "FreeTrial" | "Pro";

interface UsageStats {
  downloadCount: number;
  openPageAdsCount: number;
  openLinkAdsCount: number;
}

interface ActiveProfile {
  token: string;
  email?: string;
  membership: MembershipTier;
  usage: UsageStats;
  createdAt: number;
  expiresAt: number;
  trialMaxOps: number;
}

interface GetProfileResponse {
  ok: boolean;
  profile?: ActiveProfile;
  message?: string;
}

interface LoginResponse {
  ok: boolean;
  profile?: ActiveProfile;
  message?: string;
}

interface LogoutResponse {
  ok: boolean;
  profile?: ActiveProfile;
  message?: string;
}

const ADS_LIBRARY_URL =
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=shopify&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc#/";
const LIMIT_MESSAGE = "Your trial limit has been reached. Please upgrade to Pro to continue.";

export default function Popup() {
  const [profile, setProfile] = useState<ActiveProfile | null>(null);
  const [membershipVisible, setMembershipVisible] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Checking account...");
  const [isActionAllowed, setIsActionAllowed] = useState<boolean>(false);
  const [tokenCopied, setTokenCopied] = useState<boolean>(false);

  const [loginModalVisible, setLoginModalVisible] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");

  const totalOps = useMemo(() => {
    if (!profile) return 0;
    return profile.usage.downloadCount + profile.usage.openPageAdsCount + profile.usage.openLinkAdsCount;
  }, [profile]);

  const trialMaxOps = profile?.trialMaxOps ?? 10;

  const membershipLabel = profile?.membership === "Pro" ? "Pro (Unlimited)" : "Free Trial (100 actions limit)";
  const progressPct = Math.min(100, Math.max(0, Math.round((totalOps / trialMaxOps) * 100)));

  const recomputeAllowed = (nextProfile: ActiveProfile): boolean => {
    const used =
      nextProfile.usage.downloadCount +
      nextProfile.usage.openPageAdsCount +
      nextProfile.usage.openLinkAdsCount;
    return nextProfile.membership === "Pro" || used < nextProfile.trialMaxOps;
  };

  const refreshProfile = (): void => {
    chrome.runtime.sendMessage({ type: "GET_PROFILE" }, (response: GetProfileResponse) => {
      if (chrome.runtime.lastError) {
        setStatusMessage("Profile service is temporarily unavailable. Please try again later.");
        setIsActionAllowed(false);
        return;
      }
      if (!response?.ok || !response.profile) {
        setStatusMessage(response?.message ?? "Failed to load account profile.");
        setIsActionAllowed(false);
        return;
      }

      setProfile(response.profile);
      const allowed = recomputeAllowed(response.profile);
      setIsActionAllowed(allowed);
      setStatusMessage(allowed ? "All features are available." : LIMIT_MESSAGE);
    });
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const openAdsLibrary = (): void => {
    if (!isActionAllowed) return;
    chrome.tabs.create({ url: ADS_LIBRARY_URL, active: true });
  };

  const copyToken = async (): Promise<void> => {
    const token = profile?.token;
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      window.setTimeout(() => setTokenCopied(false), 1400);
    } catch {
      setStatusMessage("Copy failed. Please copy the token manually.");
    }
  };

  const contactSupport = (): void => {
    window.alert("Please contact customer support to renew your plan.");
  };

  const submitLogin = (): void => {
    if (loginLoading) return;
    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || password.length < 4) {
      setLoginError("Please enter a valid email and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    chrome.runtime.sendMessage({ type: "LOGIN", email, password }, (resp: LoginResponse) => {
      setLoginLoading(false);

      if (chrome.runtime.lastError) {
        setLoginError("Login failed. Please try again.");
        return;
      }

      if (!resp?.ok || !resp.profile) {
        setLoginError(resp?.message ?? "Login failed. Please try again.");
        return;
      }

      setProfile(resp.profile);
      const allowed = recomputeAllowed(resp.profile);
      setIsActionAllowed(allowed);
      setStatusMessage(allowed ? "All features are available." : LIMIT_MESSAGE);
      setLoginModalVisible(false);
      setLoginPassword("");
      setLoginError("");
    });
  };

  const logoutToGuest = (): void => {
    chrome.runtime.sendMessage({ type: "LOGOUT" }, (resp: LogoutResponse) => {
      if (chrome.runtime.lastError) {
        setStatusMessage("Logout failed. Please try again.");
        return;
      }
      if (!resp?.ok || !resp.profile) {
        setStatusMessage(resp?.message ?? "Logout failed. Please try again.");
        return;
      }

      setProfile(resp.profile);
      const allowed = recomputeAllowed(resp.profile);
      setIsActionAllowed(allowed);
      setStatusMessage(allowed ? "All features are available." : LIMIT_MESSAGE);
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
    });
  };

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <h1 className="popup-title">AdLib Pro</h1>
        <span>FB ADS Downloader</span>
        {/* 使用 react-icons 作为统一的菜单按钮样式，这里用 FaUserCircle 作为“用户中心”入口图标 */}
        <button
          className="icon-btn icon-btn-right"
          type="button"
          aria-label="Open user menu"
          onClick={() => setMembershipVisible(true)}
        >
          <FaUserCircle size={28} aria-hidden="true" />
        </button>
   
      </header>

      {membershipVisible ? (
        <main className="membership-page" role="dialog" aria-label="membership benefits">
          <div className="membership-topbar">
            <button className="back-btn" type="button" onClick={() => setMembershipVisible(false)}>
              Back
            </button>
            <div className="membership-title">Membership Benefits</div>
            <div className="topbar-actions">
              <button className="ghost-btn" type="button" onClick={refreshProfile}>
                Refresh
              </button>
              <button className="ghost-btn ghost-btn-danger" type="button" onClick={logoutToGuest}>
                Logout
              </button>
            </div>
          </div>

          <div className="token-row">
            <div className="token-label">Token:</div>
            <div className="token-value" title={profile?.token ?? ""}>
              {profile?.token ?? "-"}
            </div>
            <button className="token-btn" type="button" onClick={() => setLoginModalVisible(true)}>
              Change
            </button>
          </div>

          <div className="usage-card">
            <div className="usage-title">My Membership & Usage</div>
            <div className="usage-grid">
              <div className="usage-item">
                <div className="usage-k">Membership</div>
                <div className="usage-v">{membershipLabel}</div>
              </div>
              <div className="usage-item">
                <div className="usage-k">Account</div>
                <div className="usage-v">{profile?.email ?? "Guest"}</div>
              </div>
              <div className="usage-item usage-item-ops">
                <div className="usage-k">Total actions</div>
                <div className="usage-v">
                  {totalOps} / {trialMaxOps}
                </div>
                {profile?.membership !== "Pro" ? (
                  <div className="trial-progress-wrap">
                    <div className="trial-progress-bar" style={{ width: `${progressPct}%` }} />
                  </div>
                ) : null}
              </div>
              <div className="usage-item">
                <div className="usage-k">Download</div>
                <div className="usage-v">{profile?.usage.downloadCount ?? 0}</div>
              </div>
              <div className="usage-item">
                <div className="usage-k">Open Page Ads</div>
                <div className="usage-v">{profile?.usage.openPageAdsCount ?? 0}</div>
              </div>
              <div className="usage-item">
                <div className="usage-k">Open Link Ads</div>
                <div className="usage-v">{profile?.usage.openLinkAdsCount ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="benefits-card">
            <div className="benefits-head">
              <div />
              <div className="col-head">Free</div>
              <div className="col-head col-head-pro">Pro</div>
            </div>
            <div className="benefit-row">
              <div className="benefit-name">Download images & videos / day</div>
              <div className="benefit-val">10</div>
              <div className="benefit-val pro-highlight">Unlimited</div>
            </div>
            <div className="benefit-row">
              <div className="benefit-name">Filter ads by date range</div>
              <div className="benefit-val">✔</div>
              <div className="benefit-val">✔</div>
            </div>
            <div className="benefit-row">
              <div className="benefit-name">Ad detail info insights</div>
              <div className="benefit-val">✔</div>
              <div className="benefit-val">✔</div>
            </div>
            <div className="benefit-row">
              <div className="benefit-name">One click to open ad detail & all ads</div>
              <div className="benefit-val">✔</div>
              <div className="benefit-val">✔</div>
            </div>
          </div>

          <div className="promo-banner">
            <div className="promo-text">Enjoy 30% OFF if you purchase today! (April 2026)</div>
          </div>

          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-title">Monthly</div>
              <div className="price-main">
                <span className="price-num">$9.99</span>
                <span className="price-unit">/mo</span>
              </div>
              <button className="price-btn" type="button" onClick={contactSupport}>
                Try it now
              </button>
            </div>
            <div className="price-card">
              <div className="price-title">Quarterly</div>
              <div className="price-main">
                <span className="price-num">$5.99</span>
                <span className="price-unit">/mo</span>
              </div>
              <button className="price-btn" type="button" onClick={contactSupport}>
                Try it now
              </button>
            </div>
            <div className="price-card price-card-popular">
              <div className="popular-badge">Most Popular</div>
              <div className="price-title">Annual</div>
              <div className="price-main">
                <span className="price-num">$4.99</span>
                <span className="price-unit">/mo</span>
              </div>
              <button className="price-btn" type="button" onClick={contactSupport}>
                Try it now
              </button>
            </div>
          </div>

          <div className="membership-footnote">
            <button className="copy-token-link" type="button" onClick={copyToken}>
              {tokenCopied ? "Token copied" : "Copy token"}
            </button>
            <span className="dot">•</span>
            <span className="small-muted">{statusMessage}</span>
          </div>

          {loginModalVisible ? (
            <div className="login-overlay" role="dialog" aria-label="login dialog">
              <div className="login-modal">
                <div className="login-title">Login / Bind Account</div>
                <div className="login-subtitle">Enter your email and password to continue.</div>

                <label className="login-field">
                  <div className="login-label">Email</div>
                  <input
                    className="login-input"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>

                <label className="login-field">
                  <div className="login-label">Password</div>
                  <input
                    className="login-input"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>

                {loginError ? <div className="login-error">{loginError}</div> : null}

                <div className="login-actions">
                  <button
                    className="login-btn"
                    type="button"
                    onClick={() => setLoginModalVisible(false)}
                    disabled={loginLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`login-btn login-btn-primary ${loginLoading ? "login-btn-disabled" : ""}`}
                    type="button"
                    onClick={submitLogin}
                    disabled={loginLoading}
                  >
                    {loginLoading ? "Logging in..." : "Continue"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          
        </main>
      ) : (
        <main className="popup-main">
          <section className="popup-card">
            <img className="brand-logo" src={logoNoBg} alt="AdLib Pro logo" />
            <p className="intro-text">
              Please open <strong>Facebook Ad Library</strong> in a new tab to continue.
            </p>
            <div className={`status-chip ${isActionAllowed ? "status-active" : "status-inactive"}`}>
              {profile?.membership === "Pro"
                ? "Pro - Unlimited actions"
                : `Free Trial - ${totalOps} / ${trialMaxOps} actions used`}
            </div>
            <button
              className={`primary-btn ${!isActionAllowed ? "primary-btn-disabled" : ""}`}
              type="button"
              onClick={openAdsLibrary}
              disabled={!isActionAllowed}
            >
              Open Facebook Ads Library
            </button>
            {!isActionAllowed ? <p className="action-hint">{LIMIT_MESSAGE}</p> : null}
          </section>
          <p className="footer-text">© 2026 GrowthUp (V1.0.0)</p>
        </main>
      )}
    </div>
  );
}
