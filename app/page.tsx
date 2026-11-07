"use client";

/**
 * WHY: Master Workspace Page (`page.tsx`) — exact layout hierarchy from `index (31).html`.
 * Arranges the single chat workspace, toolbar, and optional right-side data view.
 */
import React, { useEffect } from "react";
import { Header } from "../components/Header";
import { ChatPanel } from "../components/ChatPanel";
import { AnalyticsDashboard } from "../components/AnalyticsDashboard";
import { DataPanel } from "../components/DataPanel";
import { LoadScreen } from "../components/LoadScreen";
import { NightSky } from "../components/NightSky";
import { useApp } from "../context/AppContext";

export default function Home() {
  const { language, isReady, deviceId, workspaceView } = useApp();
  const layoutKey = (name: string) => `gpr_layout_${deviceId}_${name}`;

  useEffect(() => {
    if (!isReady || !deviceId) return;
    const rightPanel = document.getElementById("rightPanel");
    const mainWindow = document.getElementById("mainWindow");
    const storedRight = localStorage.getItem(layoutKey("right_width_v2"));
    // best-practice fluid default: 35% of viewport, floored and capped (see globals.css)
    const fluidRight = Math.round(Math.min(640, Math.max(360, window.innerWidth * 0.35)));
    const rightWidth = storedRight ? Number(storedRight) : fluidRight;
    const safeRight = Math.min(Math.max(rightWidth, 360), Math.min(720, Math.max(360, window.innerWidth - 620)));

    document.documentElement.style.setProperty("--right-width", `${safeRight}px`);
    if (rightPanel) {
      rightPanel.style.width = `${safeRight}px`;
      rightPanel.style.minWidth = `${safeRight}px`;
      rightPanel.style.maxWidth = `${safeRight}px`;
    }
    if (mainWindow) {
      mainWindow.classList.toggle("right-panel-closed", localStorage.getItem(layoutKey("right_closed")) === "true");
    }
  }, [isReady, deviceId]);

  if (!isReady) {
    return <LoadScreen />;
  }

  const startResize = (e: React.MouseEvent) => {
    const mainWindow = document.getElementById("mainWindow");
    if (mainWindow?.classList.contains("right-panel-closed")) return;
    e.preventDefault();
    const targetPanel = document.getElementById("rightPanel");
    if (!targetPanel) return;
    const startX = e.clientX;
    const startWidth = targetPanel.getBoundingClientRect().width;
    const isRtl = language === "ar";
    let latestWidth = startWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const maxAllowed = Math.min(720, window.innerWidth - 320 - 240);
      const newWidth = Math.min(Math.max(isRtl ? startWidth + deltaX : startWidth - deltaX, 360), Math.max(360, maxAllowed));
      latestWidth = newWidth;
      targetPanel.style.width = `${newWidth}px`;
      targetPanel.style.minWidth = `${newWidth}px`;
      targetPanel.style.maxWidth = `${newWidth}px`;
      document.documentElement.style.setProperty("--right-width", `${newWidth}px`);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem(layoutKey("right_width_v2"), String(Math.round(latestWidth)));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <main className={`main-window single-chat-layout ${workspaceView === "analytics" ? "dashboard-panel-open" : ""}`} id="mainWindow">
      <NightSky />
      <Header />

      {/* Logo above the (shorter) chat window — name only, Inter bold, white */}
      <h1 className="chat-logo">
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, letterSpacing: "-0.02em", color: "#ffffff" }}>The Real Estate Agent</span>
      </h1>

      {/* Center Panel — Chat Workspace (below the logo) */}
      <div className="panel panel-center" id="centerPanel" role="region" aria-label="AI chat workspace">
        <ChatPanel />
      </div>

      {/* Resize Handle (Row 1 / Col 4) */}
      <div
        className="resize-handle"
        data-target="right"
        role="separator"
        aria-orientation="vertical"
        aria-label={language === "ar" ? "تغيير عرض لوحة الخريطة والتحليلات" : "Resize map and analytics panel"}
        onMouseDown={startResize}
      />

      {/* Right Panel — static-friendly data visualization */}
      <div className="panel panel-right" id="rightPanel" role="complementary" aria-label={workspaceView === "map" ? (language === "ar" ? "لوحة خريطة مصر" : "Egypt map panel") : (language === "ar" ? "لوحة التحليلات الاصطناعية" : "Synthetic analytics panel")}>
        <div className="right-panel-map-view" hidden={workspaceView !== "map"} aria-hidden={workspaceView !== "map"}>
          <DataPanel />
        </div>
        <div className="right-panel-analytics-view" hidden={workspaceView !== "analytics"} aria-hidden={workspaceView !== "analytics"}>
          <AnalyticsDashboard />
        </div>
      </div>
    </main>
  );
}
