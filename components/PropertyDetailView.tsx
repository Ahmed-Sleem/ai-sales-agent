"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useApp } from "../context/AppContext";
import type { InventoryProperty } from "../data/catalogue";

interface PropertyDetailViewProps {
  property: InventoryProperty;
  onBack: () => void;
}

export const PropertyDetailView: React.FC<PropertyDetailViewProps> = ({ property, onBack }) => {
  const { language } = useApp();
  const [activePhoto, setActivePhoto] = useState(0);
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-EG" : "en-EG";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
  const text = (en: string, ar: string) => isArabic ? ar : en;
  const photo = property.photos[activePhoto] ?? property.photos[0];
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const typeLabel: Record<InventoryProperty["propertyType"], { en: string; ar: string }> = {
    apartment: { en: "Apartment", ar: "شقة" }, townhouse: { en: "Townhouse", ar: "تاون هاوس" },
    villa: { en: "Villa", ar: "فيلا" }, chalet: { en: "Chalet", ar: "شاليه" }, penthouse: { en: "Penthouse", ar: "بنتهاوس" },
  };
  const specs = [
    { icon: "⌂", label: text("Bedrooms", "غرف النوم"), value: new Intl.NumberFormat(locale).format(property.bedrooms) },
    { icon: "▱", label: text("Interior area", "المساحة الداخلية"), value: `${new Intl.NumberFormat(locale).format(property.areaSqm)} m²` },
    ...(property.landAreaSqm ? [{ icon: "▧", label: text("Land area", "مساحة الأرض"), value: `${new Intl.NumberFormat(locale).format(property.landAreaSqm)} m²` }] : []),
    { icon: "◷", label: text("Delivery", "التسليم"), value: new Intl.NumberFormat(locale).format(property.deliveryYear) },
  ];

  return (
    <section className="property-detail-view" aria-label={text("Unit details", "تفاصيل الوحدة")} dir={isArabic ? "rtl" : "ltr"}>
      <header className="property-detail-toolbar">
        <button className="property-back-button" type="button" onClick={onBack} aria-label={text("Back to map", "العودة إلى الخريطة")}>
          <span aria-hidden="true">{isArabic ? "→" : "←"}</span>{text("Back to map", "العودة إلى الخريطة")}
        </button>
        <span className="property-demo-badge"><i aria-hidden="true" />{text("DEMO LISTING", "وحدة تجريبية")}</span>
      </header>

      <div className="property-detail-scroll">
        <div className="property-detail-gallery">
          <div className="property-detail-hero">
            <Image src={`${basePath}${photo.src}`} alt={photo.alt[language]} width={1200} height={800} unoptimized priority sizes="(max-width: 720px) 90vw, 540px" />
            <div className="property-image-count">{new Intl.NumberFormat(locale).format(activePhoto + 1)} / {new Intl.NumberFormat(locale).format(property.photos.length)}</div>
            <span className="property-photo-note">{photo.sourceUrl ? text("Illustrative stock photo · not this exact unit", "صورة توضيحية · لا تخص هذه الوحدة بعينها") : text("Synthetic demo photo", "صورة تجريبية اصطناعية")}</span>
          </div>
          {property.photos.length > 1 ? <div className="property-photo-thumbnails" role="group" aria-label={text("Property photos", "صور الوحدة")}>
            {property.photos.map((item, index) => <button key={item.src} type="button" aria-label={`${text("Show photo", "عرض الصورة")} ${index + 1}`} aria-pressed={activePhoto === index} onClick={() => setActivePhoto(index)}>
              <Image src={`${basePath}${item.src}`} alt="" width={116} height={84} unoptimized sizes="58px" />
            </button>)}
          </div> : null}
        </div>

        <div className="property-detail-summary">
          <div className="property-detail-overline">{property.city.name[language]} <span>·</span> {property.district.name[language]}</div>
          <h2>{property.title[language]}</h2>
          <p className="property-detail-community">{property.community.name[language]} <span>·</span> {typeLabel[property.propertyType][language]}</p>
          <strong className="property-detail-price">{money.format(property.priceEgp)}</strong>
          <p className="property-detail-disclaimer">{text("Illustrative price only · availability and terms are not real offers.", "السعر توضيحي فقط · التوفر والشروط ليست عروضاً حقيقية.")}</p>
        </div>

        <div className="property-spec-grid">
          {specs.map((spec) => <article key={spec.label}><span className="property-spec-icon" aria-hidden="true">{spec.icon}</span><span><small>{spec.label}</small><strong>{spec.value}</strong></span></article>)}
        </div>

        <section className="property-detail-section">
          <h3>{text("Unit overview", "نظرة عامة على الوحدة")}</h3>
          <p>{text(
            `${property.bedrooms} bedrooms · ${property.areaSqm} m² of ${property.finishing.en.toLowerCase()} living space in ${property.community.name.en}, ${property.district.name.en}. This is an illustrative sample listing for exploring Sara’s property search and recommendations.`,
            `${property.bedrooms} غرف نوم · مساحة ${property.areaSqm} م² بتشطيب ${property.finishing.ar} في ${property.community.name.ar}، ${property.district.name.ar}. هذه وحدة توضيحية لاختبار البحث والتوصيات.`,
          )}</p>
        </section>

        <section className="property-detail-section property-payment-section">
          <div className="property-section-heading"><div><h3>{text("Illustrative payment options", "خيارات سداد توضيحية")}</h3><p>{text("Sample terms only; confirm actual availability with the seller.", "شروط تجريبية فقط؛ يرجى تأكيد التوفر الفعلي مع البائع.")}</p></div></div>
          {property.paymentPlans.map((plan) => <article className="property-payment-plan" key={`${plan.installmentYears}-${plan.downPaymentPercent}`}>
            <span className="property-plan-icon" aria-hidden="true">▤</span><span className="property-plan-copy"><strong>{plan.label[language]}</strong><small>{text("Down payment", "مقدم")} · {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(plan.downPaymentPercent)}%</small></span><span className="property-plan-term">{new Intl.NumberFormat(locale).format(plan.installmentYears)} {text("years", "سنوات")}</span>
          </article>)}
        </section>

        <footer className="property-detail-footer">
          {photo.sourceUrl ? <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{text("Photo source", "مصدر الصورة")} ↗</a> : null}
          <span>{text("All listing information is synthetic demo content.", "جميع معلومات الوحدة محتوى تجريبي اصطناعي.")}</span>
        </footer>
      </div>
    </section>
  );
};
