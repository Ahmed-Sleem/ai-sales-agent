"use client";

import React, { useMemo, useState } from "react";
import { aggregateDemoAnalytics, type AnalyticsPeriod, type AnalyticsPeriodSummary, type DemoLeadStage } from "../data/analytics";
import { useApp } from "../context/AppContext";
import { INVENTORY } from "../data/catalogue";

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

export const AnalyticsDashboard: React.FC<{ fullPage?: boolean }> = ({ fullPage = false }) => {
  const { language, setWorkspaceView } = useApp();
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const snapshot = useMemo(() => aggregateDemoAnalytics(), []);
  const summary = snapshot.periods[period];
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-EG" : "en-EG";
  const number = new Intl.NumberFormat(locale);
  const maxMessages = Math.max(1, ...summary.series.map((point) => point.clientMessages));
  const confirmedLeads = summary.leadStages.confirmed;
  const conversionRate = summary.clients ? Math.round((confirmedLeads / summary.clients) * 100) : 0;
  const averagePrice = Math.round(INVENTORY.reduce((sum, property) => sum + property.priceEgp, 0) / Math.max(INVENTORY.length, 1));
  const averageArea = Math.round(INVENTORY.reduce((sum, property) => sum + property.areaSqm, 0) / Math.max(INVENTORY.length, 1));
  const marketMix = [...INVENTORY.reduce((groups, property) => {
    const group = groups.get(property.city.id) ?? { id: property.city.id, name: property.city.name, count: 0 };
    group.count += 1;
    groups.set(property.city.id, group);
    return groups;
  }, new Map<string, { id: string; name: { en: string; ar: string }; count: number }>()).values()]
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const maxMarketCount = Math.max(1, ...marketMix.map((item) => item.count));
  const trendWidth = 560;
  const trendHeight = 192;
  const trendLeft = 38;
  const trendRight = 12;
  const trendTop = 16;
  const trendBottom = 30;
  const trendPlotWidth = trendWidth - trendLeft - trendRight;
  const trendPlotHeight = trendHeight - trendTop - trendBottom;
  const maxDailyActivity = Math.max(1, ...summary.series.flatMap((point) => [point.clients, point.conversations]));
  const trendCoordinates = (key: "clients" | "conversations") => summary.series.map((point, index) => {
    const x = summary.series.length <= 1 ? trendLeft + trendPlotWidth / 2 : trendLeft + index * trendPlotWidth / (summary.series.length - 1);
    const y = trendTop + trendPlotHeight - (point[key] / maxDailyActivity) * trendPlotHeight;
    return { x, y, value: point[key], date: point.date };
  });
  const clientTrend = trendCoordinates("clients");
  const conversationTrend = trendCoordinates("conversations");
  const trendPath = (points: readonly { x: number; y: number }[]) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
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
  const paymentPreferences = [
    { id: "cash" as const, label: { en: "Cash", ar: "نقداً" }, color: "#34d399" },
    { id: "installments" as const, label: { en: "Installments", ar: "تقسيط" }, color: "#38bdf8" },
    { id: "undecided" as const, label: { en: "Undecided", ar: "لم يحدد" }, color: "#a78bfa" },
  ];
  const rejectionReasons = [
    { id: "price" as const, label: { en: "Price", ar: "السعر" } },
    { id: "location" as const, label: { en: "Location", ar: "الموقع" } },
    { id: "area" as const, label: { en: "Area", ar: "المساحة" } },
    { id: "payment_plan" as const, label: { en: "Payment plan", ar: "خطة السداد" } },
    { id: "other" as const, label: { en: "Other", ar: "أخرى" } },
  ];
  const totalPaymentPreferences = Math.max(1, Object.values(summary.paymentPreferences).reduce((sum, count) => sum + count, 0));
  const totalRejectionReasons = Math.max(1, Object.values(summary.rejectionReasons).reduce((sum, count) => sum + count, 0));

  return (
    <section className={`analytics-dashboard ${fullPage ? "analytics-dashboard--full" : ""}`} aria-label={isArabic ? "لوحة التحليلات التجريبية" : "Synthetic demo analytics dashboard"}>
      <header className="analytics-header">
        <div>
          <div className="analytics-eyebrow">{isArabic ? "نظرة عامة" : "OVERVIEW"} · {periodRange(summary, locale)}</div>
          <h2>{isArabic ? "لوحة التحليلات" : "Demo analytics"}</h2>
          <p>{isArabic ? "ملخص نشاط توضيحي للتجربة — لا يحتوي على بيانات عملاء حقيقية." : "Illustrative activity summary for the demo — no real client data."}</p>
        </div>
        {fullPage ? <a className="analytics-back-button" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}>
          <span aria-hidden="true">{isArabic ? "→" : "←"}</span> {isArabic ? "العودة إلى مساحة العمل" : "Back to workspace"}
        </a> : <button className="analytics-back-button" type="button" onClick={() => setWorkspaceView("map")}>
          <span aria-hidden="true">←</span> {isArabic ? "العودة إلى الخريطة" : "Back to map"}
        </button>}
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
        {fullPage ? <>
          <article className="analytics-kpi analytics-kpi--accent-green"><span>{isArabic ? "عملاء مؤكدون" : "Confirmed leads"}</span><strong>{number.format(confirmedLeads)}</strong><small>{isArabic ? "من الفترة المحددة" : "in the selected period"}</small></article>
          <article className="analytics-kpi analytics-kpi--accent-violet"><span>{isArabic ? "معدل التحويل" : "Lead conversion"}</span><strong>{number.format(conversionRate)}%</strong><small>{isArabic ? "من العملاء إلى مؤكدين" : "clients to confirmed"}</small></article>
          <article className="analytics-kpi analytics-kpi--accent-cyan"><span>{isArabic ? "وحدات في الكتالوج" : "Sample inventory"}</span><strong>{number.format(INVENTORY.length)}</strong><small>{isArabic ? `${number.format(averageArea)} م² متوسط المساحة` : `${number.format(averageArea)} m² average area`}</small></article>
          <article className="analytics-kpi analytics-kpi--accent-amber"><span>{isArabic ? "متوسط السعر المعروض" : "Average asking price"}</span><strong className="analytics-kpi-money">{new Intl.NumberFormat(locale, { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(averagePrice)}</strong><small>{isArabic ? "قيمة توضيحية اصطناعية" : "synthetic illustrative value"}</small></article>
        </> : null}
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

      {fullPage ? <div className="analytics-panels analytics-full-insights">
        <article className="analytics-card analytics-trend-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "نمو النشاط اليومي" : "Daily activity trend"}</h3><p>{isArabic ? "العملاء والمحادثات عبر الفترة المحددة." : "Clients and conversations across the selected period."}</p></div></div>
          <svg className="analytics-trend-chart" viewBox={`0 0 ${trendWidth} ${trendHeight}`} role="img" aria-label={isArabic ? "مخطط يومي للعملاء والمحادثات" : "Daily clients and conversations trend"}>
            {[0, 0.5, 1].map((fraction) => {
              const y = trendTop + trendPlotHeight * (1 - fraction);
              return <g key={fraction}><line x1={trendLeft} x2={trendWidth - trendRight} y1={y} y2={y} stroke="currentColor" opacity="0.12"/><text x={trendLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.65">{Math.round(maxDailyActivity * fraction)}</text></g>;
            })}
            <path d={trendPath(clientTrend)} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={trendPath(conversationTrend)} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            {clientTrend.map((point, index) => <g key={`clients-${point.date}`}><circle cx={point.x} cy={point.y} r="3" fill="#38bdf8"><title>{`${formatDate(point.date, locale)} · ${isArabic ? "عملاء" : "Clients"}: ${number.format(point.value)}`}</title></circle>{(index === 0 || index === clientTrend.length - 1 || index === Math.floor((clientTrend.length - 1) / 2)) ? <text x={point.x} y={trendHeight - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.72">{formatDate(point.date, locale)}</text> : null}</g>)}
            {conversationTrend.map((point) => <circle key={`conversations-${point.date}`} cx={point.x} cy={point.y} r="3" fill="#a78bfa"><title>{`${formatDate(point.date, locale)} · ${isArabic ? "محادثات" : "Conversations"}: ${number.format(point.value)}`}</title></circle>)}
          </svg>
          <div className="analytics-chart-legend"><span className="analytics-legend-dot"/><span>{isArabic ? "العملاء" : "Clients"}</span><span className="analytics-legend-dot analytics-legend-dot--violet"/><span>{isArabic ? "المحادثات" : "Conversations"}</span></div>
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "توزيع الكتالوج حسب المدينة" : "Sample inventory by city"}</h3><p>{isArabic ? "توزيع الوحدات التوضيحية في الكتالوج المحلي." : "Illustrative units in the local sample catalogue."}</p></div></div>
          <div className="analytics-breakdown-list analytics-city-mix">
            {marketMix.map((city) => {
              const percent = Math.round((city.count / Math.max(INVENTORY.length, 1)) * 100);
              return <div className="analytics-breakdown-row" key={city.id}>
                <div><span>{city.name[language]}</span><strong>{number.format(city.count)} <small>{percent}%</small></strong></div>
                <span className="analytics-breakdown-track"><i style={{ width: `${(city.count / maxMarketCount) * 100}%`, background: "linear-gradient(90deg,#38bdf8,#818cf8)" }} /></span>
              </div>;
            })}
          </div>
          <p className="analytics-inventory-note">{isArabic ? "الأسعار والصور والوحدات بيانات اصطناعية توضيحية." : "Prices, photos, and units are synthetic illustrative data."}</p>
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "تفضيلات السداد" : "Payment preferences"}</h3><p>{isArabic ? "اختيارات العملاء المسجلة خلال الفترة." : "Recorded client preferences for this period."}</p></div></div>
          <div className="analytics-breakdown-list">
            {paymentPreferences.map((item) => {
              const count = summary.paymentPreferences[item.id];
              const percent = Math.round((count / totalPaymentPreferences) * 100);
              return <div className="analytics-breakdown-row" key={item.id}>
                <div><span>{item.label[language]}</span><strong>{number.format(count)} <small>{percent}%</small></strong></div>
                <span className="analytics-breakdown-track"><i style={{ width: `${percent}%`, background: item.color }} /></span>
              </div>;
            })}
          </div>
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h3>{isArabic ? "أسباب رفض الوحدات" : "Property rejection reasons"}</h3><p>{isArabic ? "أكثر العوامل التي أثرت على ملاءمة الوحدة." : "Factors most often affecting property fit."}</p></div><span className="analytics-chart-total">{number.format(summary.rejections)}</span></div>
          <div className="analytics-breakdown-list">
            {rejectionReasons.map((item) => {
              const count = summary.rejectionReasons[item.id];
              const percent = Math.round((count / totalRejectionReasons) * 100);
              return <div className="analytics-breakdown-row" key={item.id}>
                <div><span>{item.label[language]}</span><strong>{number.format(count)} <small>{percent}%</small></strong></div>
                <span className="analytics-breakdown-track"><i style={{ width: `${percent}%`, background: "#fb7185" }} /></span>
              </div>;
            })}
          </div>
        </article>
      </div> : null}

      <footer className="analytics-footer">
        <strong>{isArabic ? "بيانات اصطناعية" : "SYNTHETIC DATA"}</strong>
        <span>{snapshot.notice[language]}</span>
      </footer>
    </section>
  );
};
