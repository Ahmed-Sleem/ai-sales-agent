"use client";

import React, { useMemo, useState } from "react";
import { aggregateDemoAnalytics, type AnalyticsPeriod, type AnalyticsPeriodSummary, type DemoLeadStage } from "../data/analytics";
import { useApp } from "../context/AppContext";

const STAGES: readonly DemoLeadStage[] = ["new", "qualified", "confirmed", "closed-lost"];
const STAGE_COLORS: Record<DemoLeadStage, string> = {
  new: "#38bdf8",
  qualified: "#818cf8",
  confirmed: "#34d399",
  "closed-lost": "#fb7185",
};

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}
function periodRange(summary: AnalyticsPeriodSummary, locale: string): string {
  if (summary.startDate === summary.endDate) return formatDate(summary.startDate, locale);
  return `${formatDate(summary.startDate, locale)} – ${formatDate(summary.endDate, locale)}`;
}

export const AnalyticsDashboard: React.FC = () => {
  const { language, setWorkspaceView } = useApp();
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const snapshot = useMemo(() => aggregateDemoAnalytics(), []);
  const summary = snapshot.periods[period];
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-EG" : "en-EG";
  const number = new Intl.NumberFormat(locale);
  const maxMessages = Math.max(1, ...summary.series.map((point) => point.clientMessages));
  const chartWidth = 560;
  const chartHeight = 188;
  const chartLeft = 34;
  const chartRight = 12;
  const chartTop = 12;
  const chartBottom = 34;
  const plotWidth = chartWidth - chartLeft - chartRight;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const slotWidth = plotWidth / Math.max(summary.series.length, 1);
  const periods: readonly { id: AnalyticsPeriod; label: { en: string; ar: string } }[] = [
    { id: "day", label: { en: "Day", ar: "اليوم" } },
    { id: "week", label: { en: "Week", ar: "الأسبوع" } },
    { id: "month", label: { en: "Month", ar: "الشهر" } },
  ];
  const stageLabels: Record<DemoLeadStage, { en: string; ar: string }> = {
    new: { en: "New", ar: "جديد" },
    qualified: { en: "Qualified", ar: "مؤهل" },
    confirmed: { en: "Confirmed", ar: "مؤكد" },
    "closed-lost": { en: "Closed / lost", ar: "مغلق / مفقود" },
  };
  const totalStageCount = Math.max(1, summary.clients);

  return (
    <section className="analytics-dashboard" aria-label={isArabic ? "لوحة التحليلات التجريبية" : "Synthetic demo analytics dashboard"}>
      <header className="analytics-header">
        <div>
          <div className="analytics-eyebrow">{isArabic ? "نظرة عامة" : "OVERVIEW"} · {periodRange(summary, locale)}</div>
          <h2>{isArabic ? "لوحة التحليلات" : "Demo analytics"}</h2>
          <p>{isArabic ? "ملخص نشاط توضيحي للتجربة — لا يحتوي على بيانات عملاء حقيقية." : "Illustrative activity summary for the demo — no real client data."}</p>
        </div>
        <button className="analytics-back-button" type="button" onClick={() => setWorkspaceView("chat")}>
          <span aria-hidden="true">←</span> {isArabic ? "العودة إلى المحادثة" : "Back to chat"}
        </button>
      </header>

      <div className="analytics-period-control" role="group" aria-label={isArabic ? "الفترة الزمنية" : "Analytics period"}>
        {periods.map((item) => (
          <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>
            {item.label[language]}
          </button>
        ))}
      </div>

      <div className="analytics-kpis">
        <article className="analytics-kpi"><span>{isArabic ? "العملاء" : "Clients"}</span><strong>{number.format(summary.clients)}</strong><small>{isArabic ? "عملاء تجريبيون فريدون" : "unique synthetic clients"}</small></article>
        <article className="analytics-kpi"><span>{isArabic ? "المحادثات" : "Conversations"}</span><strong>{number.format(summary.conversations)}</strong><small>{isArabic ? "محادثات تجريبية" : "demo conversations"}</small></article>
        <article className="analytics-kpi"><span>{isArabic ? "رسائل العملاء" : "Client messages"}</span><strong>{number.format(summary.clientMessages)}</strong><small>{isArabic ? "إجمالي الرسائل الواردة" : "total inbound messages"}</small></article>
        <article className="analytics-kpi"><span>{isArabic ? "تفاعلات الوحدات" : "Property interactions"}</span><strong>{number.format(summary.propertyInteractions)}</strong><small>{isArabic ? "عرض أو رفض أو تأكيد" : "shown, rejected, or confirmed"}</small></article>
      </div>

      <div className="analytics-panels">
        <article className="analytics-card analytics-chart-card">
          <div className="analytics-card-heading">
            <div><h3>{isArabic ? "رسائل العملاء حسب اليوم" : "Client messages by day"}</h3><p>{isArabic ? "عدد الرسائل الواردة في كل يوم بالفترة المحددة." : "Inbound messages on each day in the selected period."}</p></div>
            <span className="analytics-chart-total">{number.format(summary.clientMessages)}</span>
          </div>
          <svg className="analytics-bar-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={isArabic ? `مخطط رسائل العملاء: ${summary.series.map((point) => `${formatDate(point.date, locale)} ${point.clientMessages}`).join("، ")}` : `Client messages by date: ${summary.series.map((point) => `${formatDate(point.date, locale)} ${point.clientMessages}`).join(", ")}`}>
            {[0, 0.5, 1].map((fraction) => {
              const y = chartTop + plotHeight * (1 - fraction);
              return <g key={fraction}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} stroke="currentColor" opacity="0.12" /><text x={chartLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.65">{Math.round(maxMessages * fraction)}</text></g>;
            })}
            {summary.series.map((point, index) => {
              const barWidth = Math.max(4, Math.min(30, slotWidth * 0.5));
              const barHeight = (point.clientMessages / maxMessages) * plotHeight;
              const x = chartLeft + index * slotWidth + (slotWidth - barWidth) / 2;
              const y = chartTop + plotHeight - barHeight;
              return <g key={point.date}><rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill="#38bdf8" opacity="0.88"><title>{`${formatDate(point.date, locale)}: ${number.format(point.clientMessages)} ${isArabic ? "رسالة" : "messages"}`}</title></rect><text x={x + barWidth / 2} y={chartHeight - 10} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.72">{formatDate(point.date, locale)}</text></g>;
            })}
          </svg>
          <div className="analytics-chart-legend"><span className="analytics-legend-dot" />{isArabic ? "رسائل العملاء" : "Client messages"}</div>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "مراحل العملاء" : "Lead stages"}</h3><p>{isArabic ? "توزيع العملاء في الفترة المحددة." : "Client mix for the selected period."}</p></div></div>
          <div className="analytics-stage-chart" role="img" aria-label={isArabic ? "توزيع مراحل العملاء" : "Lead stage distribution"}>
            <div className="analytics-stage-stack" aria-hidden="true">
              {STAGES.map((stage) => <span key={stage} style={{ width: `${(summary.leadStages[stage] / totalStageCount) * 100}%`, background: STAGE_COLORS[stage] }} />)}
            </div>
            <ul>
              {STAGES.map((stage) => (
                <li key={stage}><span className="analytics-stage-name"><i style={{ background: STAGE_COLORS[stage] }} />{stageLabels[stage][language]}</span><strong>{number.format(summary.leadStages[stage])}</strong><small>{Math.round((summary.leadStages[stage] / totalStageCount) * 100)}%</small></li>
              ))}
            </ul>
          </div>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "الوحدات الأكثر تفاعلاً" : "Hot properties"}</h3><p>{isArabic ? "مرتبة حسب تفاعلات العملاء." : "Ranked by client interactions."}</p></div></div>
          {summary.hotProperties.length ? <ol className="analytics-ranking-list">
            {summary.hotProperties.map((property, index) => (
              <li key={property.id}><span className="analytics-rank">{index + 1}</span><span className="analytics-rank-copy"><strong>{property.name[language]}</strong><small>{property.community[language]}</small></span><span className="analytics-rank-value"><strong>{number.format(property.interactions)}</strong><small>{isArabic ? "تفاعلات" : "interactions"}</small><small>{property.confirmations} ✓ · {property.rejections} ×</small></span></li>
            ))}
          </ol> : <p className="analytics-empty">{isArabic ? "لا توجد تفاعلات في هذه الفترة." : "No property interactions in this period."}</p>}
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "المناطق الأكثر طلباً" : "Hot locations"}</h3><p>{isArabic ? "بحسب عدد العملاء التجريبيين." : "By number of synthetic clients."}</p></div></div>
          {summary.hotLocations.length ? <ol className="analytics-location-list">
            {summary.hotLocations.map((location, index) => (
              <li key={location.id}><span className="analytics-rank">{index + 1}</span><span className="analytics-rank-copy"><strong>{location.name[language]}</strong><small>{location.city[language]}</small></span><span className="analytics-location-count">{number.format(location.clients)}<small>{isArabic ? "عملاء" : "clients"}</small></span></li>
            ))}
          </ol> : <p className="analytics-empty">{isArabic ? "لا توجد مواقع مسجلة في هذه الفترة." : "No locations recorded in this period."}</p>}
        </article>
      </div>

      <footer className="analytics-footer">
        <strong>{isArabic ? "بيانات اصطناعية" : "SYNTHETIC DATA"}</strong>
        <span>{snapshot.notice[language]}</span>
      </footer>
    </section>
  );
};
