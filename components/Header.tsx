"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";

/** Compact toolbar for language, settings, and the optional right-side map. */
export const Header: React.FC = () => {
  const { language, setLanguage, setIsSettingsOpen, workspaceView, setWorkspaceView, deviceId } = useApp();
  const [isRightPanelClosed, setIsRightPanelClosed] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    setIsRightPanelClosed(localStorage.getItem(`gpr_layout_${deviceId}_right_closed`) === "true");
  }, [deviceId]);

  const toggleRightPanel = () => {
    const mainWindow = document.getElementById("mainWindow");
    if (!mainWindow) return;
    const closed = mainWindow.classList.toggle("right-panel-closed");
    setIsRightPanelClosed(closed);
    if (deviceId) localStorage.setItem(`gpr_layout_${deviceId}_right_closed`, String(closed));
  };

  return (
    <header className="app-header" id="appHeader">
      <div className="header-tools" role="toolbar" aria-label={language === "ar" ? "أدوات مساحة العمل" : "Workspace tools"}>
        <button
          className="tool-btn"
          id="langSwitch"
          type="button"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </button>

        <button
          className={`tool-btn ${workspaceView === "dashboard" ? "active-closed" : ""}`}
          id="dashboardToggleBtn"
          type="button"
          onClick={() => setWorkspaceView(workspaceView === "chat" ? "dashboard" : "chat")}
          aria-label={workspaceView === "chat" ? (language === "ar" ? "فتح لوحة التحليلات" : "Open analytics dashboard") : (language === "ar" ? "العودة إلى المحادثة" : "Return to chat")}
          aria-pressed={workspaceView === "dashboard"}
          title={workspaceView === "chat" ? (language === "ar" ? "لوحة التحليلات التجريبية" : "Demo analytics dashboard") : (language === "ar" ? "العودة إلى المحادثة" : "Return to chat")}
        >
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h17M8 15V9m5 6V5m5 10v-4" />
          </svg>
        </button>

        <button
          className="tool-btn"
          id="apiKeyBtn"
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label={language === "ar" ? "الإعدادات" : "Settings"}
          title={language === "ar" ? "الإعدادات" : "Settings"}
          style={{ width: "36px", height: "36px", minWidth: "36px", maxWidth: "36px", flex: "0 0 36px", borderRadius: "10px", padding: 0, justifyContent: "center", gap: 0 }}
        >
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <button
          className={`tool-btn ${isRightPanelClosed ? "active-closed" : ""}`}
          id="panelToggleBtn"
          type="button"
          onClick={toggleRightPanel}
          aria-label={language === "ar" ? "تبديل خريطة مصر" : "Toggle Egypt map"}
          aria-pressed={isRightPanelClosed}
          title={isRightPanelClosed
            ? (language === "ar" ? "إظهار الخريطة" : "Show map")
            : (language === "ar" ? "إخفاء الخريطة" : "Hide map")}
        >
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20V6.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 4v13.5M15.5 6.5V20" />
          </svg>
        </button>
      </div>
    </header>
  );
};
