import {
  TOOLBAR_ABOVE_HR_CLASS,
  ACTIONS_WRAP_CLASS,
  ACTION_BUTTON_CLASS,
  AD_DIVIDER_HR_SELECTOR_EXACT
} from './domManipulator';
import { AD_INFO_PANEL_CLASS } from './uiComponents';

const STYLE_TAG_ID = "adlib-pro-style-tag";

/**
 * 注入样式到页面
 */
export function injectStyles(): void {
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
      padding: 1px 1px 1px 5px;
    }

    .${ACTIONS_WRAP_CLASS} {
      display: flex;
      align-items: center;
      gap: 2px;
      /* 防止被父容器挤压换行 */
      flex-wrap: nowrap !important;
      /* 防止容器被压缩 */
      white-space: nowrap;
      width: 100%;
    }

    .${ACTION_BUTTON_CLASS} {
      align-items: center;
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
      padding: 5px 10px;
      cursor: pointer;
      box-shadow: none;
      transition: background-color 0.1s ease, border-color 0.1s ease;
      /* 按钮不缩小、不换行 */
      flex-shrink: 0;
      white-space: nowrap;
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
      justify-content: center;
      grid-template-columns: 1fr 2fr 1fr 5fr;
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
