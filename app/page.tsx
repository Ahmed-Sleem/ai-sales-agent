"use client";

/**
 * WHY: Master Workspace Page (`page.tsx`) — exact layout hierarchy from `index (31).html`.
 * Arranges Title, Mobile Drawer Backdrop, Left Panel, Header (floating toolbar in row 5),
 * Center Panel (Chat Workspace), right resize-handle, and Right Panel (Map / Obsidian Graph View).
 */
import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { LeftPanel } from "../components/LeftPanel";
import { ChatPanel } from "../components/ChatPanel";
import { DataPanel } from "../components/DataPanel";
import { LoadScreen } from "../components/LoadScreen";
import { NightSky } from "../components/NightSky";
import { useApp } from "../context/AppContext";

export default function Home() {
  const { language, isReady, deviceId } = useApp();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const layoutKey = (name: string) => `gpr_layout_${deviceId}_${name}`;

  useEffect(() => {
    if (!isReady || !deviceId) return;
    const leftPanel = document.getElementById("leftPanel");
    const rightPanel = document.getElementById("rightPanel");
    const mainWindow = document.getElementById("mainWindow");
    const leftWidth = Number(localStorage.getItem(layoutKey("left_width")) || "280");
    const storedRight = localStorage.getItem(layoutKey("right_width_v2"));
    // best-practice fluid default: 35% of viewport, floored and capped (see globals.css)
    const fluidRight = Math.round(Math.min(640, Math.max(360, window.innerWidth * 0.35)));
    const rightWidth = storedRight ? Number(storedRight) : fluidRight;
    const safeLeft = Math.min(Math.max(leftWidth, 280), 420);
    const safeRight = Math.min(Math.max(rightWidth, 360), Math.min(720, Math.max(360, window.innerWidth - 620)));

    document.documentElement.style.setProperty("--left-width", `${safeLeft}px`);
    document.documentElement.style.setProperty("--right-width", `${safeRight}px`);
    if (leftPanel) {
      leftPanel.style.width = `${safeLeft}px`;
      leftPanel.style.minWidth = `${safeLeft}px`;
      leftPanel.style.maxWidth = `${safeLeft}px`;
    }
    if (rightPanel) {
      rightPanel.style.width = `${safeRight}px`;
      rightPanel.style.minWidth = `${safeRight}px`;
      rightPanel.style.maxWidth = `${safeRight}px`;
    }
    if (mainWindow) {
      mainWindow.classList.toggle("right-panel-closed", localStorage.getItem(layoutKey("right_closed")) === "true");
    }
  }, [isReady, deviceId]);

  useEffect(() => {
    document.body.classList.toggle("mobile-sidebar-open", isMobileSidebarOpen);
    document.body.style.overflow = isMobileSidebarOpen ? "hidden" : "";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 768) setIsMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("mobile-sidebar-open");
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    // Keep chats/search open by default; only restore a user-saved closed state.
    const mw = document.getElementById("mainWindow");
    if (!mw) return;
    mw.classList.toggle("left-panel-closed", localStorage.getItem(`gpr_layout_${deviceId}_left_closed`) === "true");
  }, [isReady, deviceId]);

  if (!isReady) {
    return <LoadScreen />;
  }

  const startResize = (e: React.MouseEvent, target: "left" | "right" = "right") => {
    const mainWindow = document.getElementById("mainWindow");
    if (target === "right" && mainWindow && mainWindow.classList.contains("right-panel-closed")) return;
    e.preventDefault();

    const startX = e.clientX;
    const targetPanel = document.getElementById(target === "left" ? "leftPanel" : "rightPanel");
    if (!targetPanel) return;
    const startWidth = targetPanel.getBoundingClientRect().width;
    const isRtl = language === "ar";
    let latestWidth = startWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const leftMin = 280;
      if (target === "left") {
        let newWidth = isRtl ? startWidth - deltaX : startWidth + deltaX;
        const maxAllowed = Math.min(420, Math.max(leftMin, window.innerWidth - 420));
        newWidth = Math.min(Math.max(newWidth, leftMin), maxAllowed);
        latestWidth = newWidth;
        targetPanel.style.width = `${newWidth}px`;
        targetPanel.style.minWidth = `${newWidth}px`;
        targetPanel.style.maxWidth = `${newWidth}px`;
        document.documentElement.style.setProperty("--left-width", `${newWidth}px`);
        return;
      }

      let newWidth = isRtl ? startWidth + deltaX : startWidth - deltaX;
      const maxAllowed = Math.min(720, window.innerWidth - 320 - 240);
      newWidth = Math.min(Math.max(newWidth, 360), Math.max(360, maxAllowed));

      latestWidth = newWidth;
      targetPanel.style.width = `${newWidth}px`;
      targetPanel.style.minWidth = `${newWidth}px`;
      targetPanel.style.maxWidth = `${newWidth}px`;
      document.documentElement.style.setProperty("--right-width", `${newWidth}px`);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem(layoutKey(target === "left" ? "left_width" : "right_width_v2"), String(Math.round(latestWidth)));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Restore a deliberate closed state, otherwise keep the conversations menu visible from startup.
  const leftClosedInitially = typeof window !== "undefined" && localStorage.getItem(`gpr_layout_${deviceId}_left_closed`) === "true";
  return (
    <main className={`main-window${leftClosedInitially ? " left-panel-closed" : ""}`} id="mainWindow">
      <NightSky />
      {/* Mobile Drawer Backdrop */}
      <div
        className="mobile-backdrop"
        id="mobileBackdrop"
        aria-hidden={!isMobileSidebarOpen}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* Left Panel — Sidebar (Row 3 / Col 1 on desktop, Drawer on mobile) */}
      <div className="panel panel-left" id="leftPanel" role="complementary" aria-label="Conversation history">
        <LeftPanel onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)} />
      </div>

      {/* Header Bar — floating buttons right below the left panel (Row 5 / Col 1) */}
      <Header
        isMobileSidebarOpen={isMobileSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((open) => !open)}
      />

      {/* Left Resize Handle — only side of left panel beside the middle panel */}
      <div
        className="resize-handle left-resize-handle"
        data-target="left"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize conversation panel"
        onMouseDown={(event) => startResize(event, "left")}
      />

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
        aria-label="Resize document panel"
        onMouseDown={(event) => startResize(event, "right")}
      />

      {/* Right Panel — Map / Knowledge Graph View (Row 1 / Col 5) */}
      <div className="panel panel-right" id="rightPanel" role="complementary" aria-label="Knowledge graph map">
        <DataPanel />
      </div>
    </main>
  );
}
