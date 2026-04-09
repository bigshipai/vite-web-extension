import React, { useEffect, useMemo, useRef, useState } from "react";
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

const ADS_LIBRARY_URL =
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=shopify&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc#/";
const LIMIT_MESSAGE = "Your trial limit has been reached. Please upgrade to Pro to continue.";

export default function Popup() {
  const [profile, setProfile] = useState<ActiveProfile | null>(null);
  const [membershipVisible, setMembershipVisible] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Checking account...");
  const [isActionAllowed, setIsActionAllowed] = useState<boolean>(false);
  const [tokenCopied, setTokenCopied] = useState<boolean>(false);
  const supportRef = useRef<HTMLDivElement | null>(null);
  const [showUpgradePlan, setShowUpgradePlan] = useState<boolean>(false);

  const totalOps = useMemo(() => {
    if (!profile) return 0;
    return profile.usage.downloadCount + profile.usage.openPageAdsCount + profile.usage.openLinkAdsCount;
  }, [profile]);

  const trialMaxOps = profile?.trialMaxOps ?? 10;
  const isTrialMember = profile?.membership !== "Pro";

  const membershipLabel = profile?.membership === "Pro" ? "Pro (Unlimited)" : "Free (10 actions limit)";
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
    supportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <h1 className="popup-title">AdLib Pro</h1>
        <span>FB ADS Downloader</span>
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
            <button className="ghost-btn" type="button" onClick={refreshProfile}>
              Refresh
            </button>
          </div>

          <div className="token-row">
            <div className="token-label">Token:</div>
            <div className="token-value" title={profile?.token ?? ""}>
              {profile?.token ?? "-"}
            </div>
            <button className="token-btn" type="button" onClick={copyToken}>
              {tokenCopied ? "Token copied" : "Copy token"}
            </button>
          </div>

          <div className="usage-card">
            <div className="usage-top">
              <div className="usage-item">
                <div className="usage-k">Membership</div>
                <div className="usage-v">{membershipLabel}</div>
              </div>
              <div className="usage-item">
                <div className="usage-k">Account</div>
                <div className="usage-v">{profile?.email ?? "Guest"}</div>
              </div>
            </div>

            <div className="usage-breakdown">
              <div className="usage-header-row">
                <div className="usage-title">Usage</div>
                <div className="usage-total">
                  {totalOps} / {trialMaxOps}
                </div>
              </div>
              {profile?.membership !== "Pro" ? (
                <div className="trial-progress-wrap">
                  <div className="trial-progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
              ) : null}
              <div className="usage-grid usage-grid-compact">
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
          </div>
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
            {isTrialMember ? (
              <button className="upgrade-btn" type="button" onClick={() => setShowUpgradePlan(true)}>
                Upgrade Subscription
              </button>
            ) : null}
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
          {isTrialMember && showUpgradePlan ? (
            <div
              className="plan-overlay"
              role="dialog"
              aria-label="upgrade subscription"
              onClick={() => setShowUpgradePlan(false)}
            >
              <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="plan-close-btn"
                  type="button"
                  aria-label="Close upgrade plan"
                  onClick={() => setShowUpgradePlan(false)}
                >
                  ×
                </button>
                <div className="plan-card">
                  <div className="plan-header">
                    <div className="plan-title">Free vs Pro</div>
                    <div className="plan-badge">Annual Plan</div>
                  </div>
                  <div className="benefits-head">
                    <div />
                    <div className="col-head">Free</div>
                    <div className="col-head col-head-pro">Pro</div>
                  </div>
                  <div className="benefit-row">
                    <div className="benefit-name">Total actions available</div>
                    <div className="benefit-val">10 total</div>
                    <div className="benefit-val pro-highlight">Unlimited</div>
                  </div>
                  <div className="plan-divider" />
                  <div className="plan-offer-text">Yearly subscription: was $9.9/year, now only $6.99/year.</div>
                  <div className="price-main">
                    <span className="price-old">$9.9/year</span>
                    <span className="price-num">Now $6.99/year</span>
                  </div>
                  <button
                    className="price-btn"
                    type="button"
                    onClick={() => {
                      setShowUpgradePlan(false);
                      contactSupport();
                    }}
                  >
                    Contact to Subscribe
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="support-card" ref={supportRef}>
            <div className="support-title">Contact Support</div>
            {/* <div className="support-subtitle">Choose any channel below to contact customer service.</div> */}
            <div className="support-grid">
              <div className="support-item">
                <img className="support-qr" src="/telegram_yexl1123.jpg" alt="Telegram QR code" />
                <div className="support-label">Telegram</div>
                <a
                  className="support-link"
                  href="https://t.me/yexl1123"
                  target="_blank"
                  rel="noreferrer"
                >
                  t.me/yexl1123
                </a>
              </div>
              <div className="support-item">
                <img className="support-qr" src="/whatapp.jpg" alt="WhatsApp QR code" />
                <div className="support-label">WhatsApp</div>
                <a
                  className="support-link"
                  href="https://wa.me/qr/ZZR2EB3MS7VJM1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WhatsApp
                </a>
              </div>
              <div className="support-item">
                <img className="support-qr" src="/wechat.jpg" alt="WeChat QR code" />
                <div className="support-label">WeChat</div>
                <div className="support-id">wx-dpl-ncfs</div>
              </div>
            </div>
          </div>
          <p className="footer-text">© 2026 GrowthUp (V1.0.0)</p>
        </main>
      )}
    </div>
  );
}
