"use client";

/**
 * WHY: Global Modals Wrapper (`GlobalModals.tsx`).
 * Renders `SettingsModal` at the absolute root outside `.main-window`.
 * This guarantees 100% immunity to CSS Grid layout traps, `pointer-events: none`, or stacking freeze bugs (`Rule 21`).
 */
import React from "react";
import { useApp } from "../context/AppContext";
import { SettingsModal } from "./SettingsModal";

export const GlobalModals: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen } = useApp();

  return (
    <>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
