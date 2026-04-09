import React, { useEffect, useMemo, useState } from "react";
import logoNoBg from "@assets/img/logo-no-bg.png";

interface LicenseInfo {
  licenseKey: string;
  planName: string;
  status: "active" | "inactive";
  createdAt: number;
  expiresAt: number;
}

interface LicenseResponse {
  ok: boolean;
  message?: string;
  license?: LicenseInfo;
}

const ADS_LIBRARY_URL = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=shopify&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc#/";
const CONTACT_MESSAGE = "Your key is invalid. Please contact customer support to renew your plan.";

function formatDate(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function getRemainingDays(expiresAt: number): number {
  const remainMs = expiresAt - Date.now();
  return Math.max(0, Math.ceil(remainMs / (24 * 60 * 60 * 1000)));
}

export default function Popup() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [isLicenseValid, setIsLicenseValid] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Checking license status...");
  const [panelVisible, setPanelVisible] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const statusText = useMemo(() => {
    return isLicenseValid ? "Active" : "Invalid";
  }, [isLicenseValid]);

  const remainDays = useMemo(() => {
    if (!license) return 0;
    return getRemainingDays(license.expiresAt);
  }, [license]);

  useEffect(() => {
    const fetchLicenseInfo = (): void => {
      chrome.runtime.sendMessage({ type: "GET_LICENSE_INFO" }, (response: LicenseResponse) => {
        if (chrome.runtime.lastError) {
          setStatusMessage("License service is temporarily unavailable. Please try again later.");
          return;
        }
        if (response?.ok && response.license) {
          setLicense(response.license);
        }
      });
    };

    const validateLicense = (): void => {
      chrome.runtime.sendMessage({ type: "VALIDATE_LICENSE" }, (response: LicenseResponse) => {
        if (chrome.runtime.lastError) {
          setIsLicenseValid(false);
          setStatusMessage("License validation failed. Please try again later.");
          return;
        }

        setIsLicenseValid(Boolean(response?.ok));
        setStatusMessage(response?.ok ? "All features are available." : (response?.message ?? CONTACT_MESSAGE));
      });
    };

    fetchLicenseInfo();
    validateLicense();
  }, []);

  const openAdsLibrary = (): void => {
    if (!isLicenseValid) return;
    chrome.tabs.create({ url: ADS_LIBRARY_URL, active: true });
  };

  const copyLicenseKey = async (): Promise<void> => {
    if (!license?.licenseKey) return;
    try {
      await navigator.clipboard.writeText(license.licenseKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setStatusMessage("Copy failed. Please copy the key manually.");
    }
  };

  const contactSupport = (): void => {
    window.alert("Please contact customer support to renew your plan.");
  };

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <h1 className="popup-title">AdLib Pro</h1> <span> FB ADS Downloader</span>
        <button className="icon-btn icon-btn-right" type="button" aria-label="toggle license details" onClick={() => setPanelVisible((prev) => !prev)}>
          <img src={logoNoBg} alt="License status" />
        </button>
      </header>

      <main className="popup-main">
        <section className="popup-card">
          <img className="brand-logo" src={logoNoBg} alt="AdLib Pro logo" />

          <p className="intro-text">
            Please open <strong>Facebook Ad Library</strong> in a new tab and log in to Facebook to continue.
          </p>

          <div className={`status-chip ${isLicenseValid ? "status-active" : "status-inactive"}`}>
            {isLicenseValid ? "Key Valid - Actions Available" : "Key Invalid - Contact Support"}
          </div>

          <button
            className={`primary-btn ${!isLicenseValid ? "primary-btn-disabled" : ""}`}
            type="button"
            onClick={openAdsLibrary}
            disabled={!isLicenseValid}
          >
            Open Facebook Ads Library
          </button>
          {!isLicenseValid ? <p className="action-hint">Your key is invalid. This action is disabled.</p> : null}
        </section>

        <p className="footer-text">© 2026 GrowthUp (V1.0.0)</p>
      </main>

      {panelVisible ? (
        <aside className="license-panel" role="dialog" aria-label="license info">
          <h2>Plan & License Details</h2>
          <p>
            <strong>Status: </strong>
            <span className={isLicenseValid ? "ok" : "invalid"}>{statusText}</span>
          </p>
          <p>
            <strong>Plan: </strong>
            {license?.planName ?? "-"}
          </p>
          <p>
            <strong>Key: </strong>
            <span className="license-key">{license?.licenseKey ?? "-"}</span>
          </p>
          <p>
            <strong>Created At: </strong>
            {license ? formatDate(license.createdAt) : "-"}
          </p>
          <p>
            <strong>Expires At: </strong>
            {license ? formatDate(license.expiresAt) : "-"}
          </p>
          <p>
            <strong>Days Left: </strong>
            {license ? `${remainDays} days` : "-"}
          </p>
          <div className="panel-actions">
            <button className="panel-btn panel-btn-copy" type="button" onClick={copyLicenseKey}>
              {copied ? "Copied" : "Copy Key"}
            </button>
            <button className="panel-btn panel-btn-contact" type="button" onClick={contactSupport}>
              Contact Support
            </button>
          </div>
          <p className="hint-text">{statusMessage}</p>
        </aside>
      ) : null}
    </div>
  );
}
