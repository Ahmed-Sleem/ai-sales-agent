"use client";

import React from "react";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard";
import { NightSky } from "../../components/NightSky";
import { useApp } from "../../context/AppContext";

export default function AnalysisPage() {
  const { language } = useApp();
  const isArabic = language === "ar";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <main className="analysis-page-shell" dir={isArabic ? "rtl" : "ltr"}>
      <NightSky />
      <header className="analysis-topbar">
        <a className="analysis-brand" href={`${basePath}/`}>
          <span className="analysis-brand-mark" aria-hidden="true">R</span>
          <span><strong>The Real Estate Agent</strong><small>{isArabic ? "ذكاء الأعمال العقارية" : "PROPERTY INTELLIGENCE"}</small></span>
        </a>
        <div className="analysis-topbar-meta">
          <span className="analysis-live-indicator"><i aria-hidden="true" />{isArabic ? "لوحة تجريبية" : "DEMO ANALYTICS"}</span>
          <span>{isArabic ? "مصر" : "EGYPT"} · {new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-EG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date("2026-11-07T12:00:00Z"))}</span>
        </div>
      </header>
      <AnalyticsDashboard fullPage />
    </main>
  );
}
