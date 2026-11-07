"use client";

import React from "react";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard";
import { NightSky } from "../../components/NightSky";
import { useApp } from "../../context/AppContext";

export default function AnalysisPage() {
  const { language } = useApp();
  const isArabic = language === "ar";

  return (
    <main className="analysis-page-shell" dir={isArabic ? "rtl" : "ltr"}>
      <NightSky />
      <header className="analysis-page-heading">
        <h1 className="analysis-page-title">The Real Estate Agent</h1>
      </header>
      <AnalyticsDashboard fullPage />
    </main>
  );
}
