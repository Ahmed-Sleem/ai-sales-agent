"use client";

import React, { useMemo, useState } from "react";
import { EGYPT_MAP_SOURCE, EGYPT_MAP_VIEWBOX, EGYPT_LOCATION_MARKERS, EGYPT_PROPERTY_MARKERS, EGYPT_SVG_PATH, projectEgyptCoordinate, type EgyptLocationMarker } from "../data/egyptMap";
import { INVENTORY, INVENTORY_NOTICE, type InventoryProperty } from "../data/catalogue";
import { useApp } from "../context/AppContext";

const PROPERTIES_BY_ID = new Map<string, InventoryProperty>(INVENTORY.map((property) => [property.id, property] as [string, InventoryProperty]));
const nameIn = (value: { en: string; ar: string }, language: "en" | "ar") => value[language];

function formatEgp(amount: number, language: "en" | "ar"): string {
  return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", {
    style: "currency", currency: "EGP", maximumFractionDigits: 0,
  }).format(amount);
}

export const EgyptMapView: React.FC = () => {
  const { language, setVizSelection } = useApp();
  const [cityId, setCityId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const isArabic = language === "ar";

  const cities = EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "city");
  const districts = EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "district" && marker.cityId === cityId);
  const communities = EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "community" && marker.districtId === districtId);
  const properties = useMemo(() => EGYPT_PROPERTY_MARKERS.filter((marker) =>
    marker.cityId === cityId && marker.districtId === districtId && marker.communityId === communityId,
  ), [cityId, districtId, communityId]);
  const visibleLocations = !cityId ? cities : !districtId ? districts : !communityId ? communities : [];
  const selectedProperty = propertyId ? PROPERTIES_BY_ID.get(propertyId) ?? null : null;
  const currentCity = cities.find((marker) => marker.cityId === cityId) ?? null;
  const currentDistrict = districts.find((marker) => marker.districtId === districtId) ?? null;
  const currentCommunity = communities.find((marker) => marker.communityId === communityId) ?? null;
  const title = !cityId
    ? (isArabic ? "خريطة مصر التجريبية" : "Egypt demo map")
    : !districtId
      ? nameIn(currentCity?.name ?? { en: "Egypt", ar: "مصر" }, language)
      : !communityId
        ? nameIn(currentDistrict?.name ?? { en: "Area", ar: "منطقة" }, language)
        : nameIn(currentCommunity?.name ?? { en: "Community", ar: "مجتمع" }, language);

  const selectLocation = (marker: EgyptLocationMarker) => {
    setPropertyId(null);
    if (marker.level === "city") {
      setCityId(marker.cityId);
      setDistrictId(null);
      setCommunityId(null);
    } else if (marker.level === "district") {
      setCityId(marker.cityId);
      setDistrictId(marker.districtId ?? null);
      setCommunityId(null);
    } else {
      setCityId(marker.cityId);
      setDistrictId(marker.districtId ?? null);
      setCommunityId(marker.communityId ?? null);
    }
    setVizSelection({
      id: marker.id,
      name: nameIn(marker.name, language),
      detail: isArabic ? `${marker.propertyCount} وحدات تجريبية` : `${marker.propertyCount} demo properties`,
    });
  };

  const selectProperty = (property: InventoryProperty) => {
    setPropertyId(property.id);
    setVizSelection({
      id: property.id,
      name: nameIn(property.title, language),
      detail: `${nameIn(property.community.name, language)} · ${property.areaSqm} m²`,
    });
  };

  const resetMap = () => {
    setCityId(null);
    setDistrictId(null);
    setCommunityId(null);
    setPropertyId(null);
    setVizSelection(null);
  };

  const chooseBreadcrumb = (level: "egypt" | "city" | "district") => {
    setPropertyId(null);
    if (level === "egypt") {
      resetMap();
    } else if (level === "city") {
      setDistrictId(null);
      setCommunityId(null);
      setVizSelection(currentCity ? { id: currentCity.id, name: nameIn(currentCity.name, language), detail: `${currentCity.propertyCount} demo properties` } : null);
    } else {
      setCommunityId(null);
      setVizSelection(currentDistrict ? { id: currentDistrict.id, name: nameIn(currentDistrict.name, language), detail: `${currentDistrict.propertyCount} demo properties` } : null);
    }
  };

  const locationButton = (marker: EgyptLocationMarker, index: number) => {
    const point = projectEgyptCoordinate(marker.coordinates.latitude, marker.coordinates.longitude, EGYPT_MAP_VIEWBOX);
    const markerName = nameIn(marker.name, language);
    const radius = Math.min(15, 7 + marker.propertyCount);
    return (
      <g
        key={marker.id}
        className="egypt-map-marker"
        role="button"
        tabIndex={0}
        aria-label={isArabic ? `${markerName}، ${marker.propertyCount} وحدات تجريبية` : `${markerName}, ${marker.propertyCount} synthetic demo properties`}
        onClick={() => selectLocation(marker)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectLocation(marker);
          }
        }}
      >
        <title>{`${markerName} · ${marker.propertyCount}`}</title>
        <circle cx={point.x} cy={point.y} r={radius + 8} fill="#38bdf8" opacity="0.12" />
        <circle cx={point.x} cy={point.y} r={radius} fill="#38bdf8" stroke="#e0f2fe" strokeWidth="2" />
        <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#052033" pointerEvents="none" aria-hidden="true">{Math.min(marker.propertyCount, 99)}</text>
        <text x={point.x + radius + 6} y={point.y + (index % 2 ? 4 : -6)} fontSize="12" fontWeight="700" fill="#f8fafc" paintOrder="stroke" stroke="#07111f" strokeWidth="3" strokeLinejoin="round" pointerEvents="none" aria-hidden="true">{markerName}</text>
      </g>
    );
  };

  const propertyButton = (property: InventoryProperty, index: number) => {
    const point = projectEgyptCoordinate(property.coordinates.latitude, property.coordinates.longitude, EGYPT_MAP_VIEWBOX);
    const propertyName = nameIn(property.title, language);
    return (
      <g
        key={property.id}
        className="egypt-map-marker"
        role="button"
        tabIndex={0}
        aria-label={isArabic ? `${propertyName}، ${property.areaSqm} متر مربع` : `${propertyName}, ${property.areaSqm} square metres`}
        onClick={() => selectProperty(property)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectProperty(property);
          }
        }}
      >
        <title>{propertyName}</title>
        <circle cx={point.x} cy={point.y} r={propertyId === property.id ? 12 : 7} fill={propertyId === property.id ? "#fbbf24" : "#a78bfa"} stroke="#f5f3ff" strokeWidth="2" />
        <text x={point.x + 11} y={point.y + (index % 2 ? 12 : -7)} fontSize="11" fontWeight="700" fill="#fff" paintOrder="stroke" stroke="#07111f" strokeWidth="3" strokeLinejoin="round" pointerEvents="none" aria-hidden="true">{propertyName}</text>
      </g>
    );
  };

  const propertyList = communityId
    ? properties.map((marker) => PROPERTIES_BY_ID.get(marker.id)).filter((property): property is InventoryProperty => Boolean(property))
    : [];

  return (
    <section className="egypt-map-panel" aria-label={isArabic ? "خريطة تفاعلية تجريبية لمصر" : "Interactive synthetic Egypt map"}>
      <header className="egypt-map-heading">
        <div>
          <h2>{isArabic ? "خريطة المواقع" : "Property locations"}</h2>
          <p>{isArabic ? "بيانات ومواقع تجريبية توضيحية فقط" : "Illustrative synthetic locations and listings"}</p>
        </div>
        <span className="egypt-map-badge">DEMO</span>
      </header>

      <nav className="egypt-map-breadcrumbs" aria-label={isArabic ? "مسار الخريطة" : "Map navigation"}>
        <button type="button" onClick={() => chooseBreadcrumb("egypt")} aria-current={!cityId ? "page" : undefined}>{isArabic ? "مصر" : "Egypt"}</button>
        {cityId && <><span aria-hidden="true">›</span><button type="button" onClick={() => chooseBreadcrumb("city")} aria-current={cityId && !districtId ? "page" : undefined}>{nameIn(currentCity?.name ?? { en: "City", ar: "مدينة" }, language)}</button></>}
        {districtId && <><span aria-hidden="true">›</span><button type="button" onClick={() => chooseBreadcrumb("district")} aria-current={districtId && !communityId ? "page" : undefined}>{nameIn(currentDistrict?.name ?? { en: "Area", ar: "منطقة" }, language)}</button></>}
        {communityId && <><span aria-hidden="true">›</span><span aria-current="page">{nameIn(currentCommunity?.name ?? { en: "Community", ar: "مجتمع" }, language)}</span></>}
        {(cityId || districtId || communityId) && <button className="egypt-map-reset" type="button" onClick={resetMap}>{isArabic ? "عرض الكل" : "Reset"}</button>}
      </nav>

      <div className="egypt-map-canvas" dir="ltr">
        <svg
          className="egypt-map-svg"
          viewBox={`0 0 ${EGYPT_MAP_VIEWBOX.width} ${EGYPT_MAP_VIEWBOX.height}`}
          role="group"
          aria-label={isArabic ? `خريطة مصر، ${title}` : `Map of Egypt, ${title}`}
        >
          <defs>
            <linearGradient id="egypt-map-ocean" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#10243a"/><stop offset="1" stopColor="#071321"/></linearGradient>
            <pattern id="egypt-map-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#9fb8ce" strokeOpacity="0.08" strokeWidth="1"/></pattern>
          </defs>
          <rect width={EGYPT_MAP_VIEWBOX.width} height={EGYPT_MAP_VIEWBOX.height} fill="url(#egypt-map-ocean)" />
          <rect width={EGYPT_MAP_VIEWBOX.width} height={EGYPT_MAP_VIEWBOX.height} fill="url(#egypt-map-grid)" />
          <path d={EGYPT_SVG_PATH} fill="#20364c" fillRule="evenodd" stroke="#d6e4f0" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" />
          <text x="360" y="45" textAnchor="middle" fill="#b5c8da" fontSize="15" fontWeight="700" letterSpacing="3" aria-hidden="true">EGYPT</text>
          {visibleLocations.map(locationButton)}
          {propertyList.map(propertyButton)}
        </svg>
      </div>

      <div className="egypt-map-summary">
        <strong>{title}</strong>
        <span>{!cityId ? (isArabic ? "اختر مدينة لاستكشاف المناطق" : "Choose a city to explore its areas") : !districtId ? (isArabic ? `${districts.length} مناطق · ${currentCity?.propertyCount ?? 0} وحدات تجريبية` : `${districts.length} areas · ${currentCity?.propertyCount ?? 0} synthetic properties`) : !communityId ? (isArabic ? `${communities.length} مجتمعات · ${currentDistrict?.propertyCount ?? 0} وحدات تجريبية` : `${communities.length} communities · ${currentDistrict?.propertyCount ?? 0} synthetic properties`) : (isArabic ? `${propertyList.length} وحدات تجريبية` : `${propertyList.length} synthetic properties`)}</span>
      </div>

      {visibleLocations.length > 0 && (
        <div className="egypt-map-location-list" aria-label={isArabic ? "المواقع المتاحة" : "Available locations"}>
          {visibleLocations.map((marker) => (
            <button key={marker.id} type="button" onClick={() => selectLocation(marker)}>
              <span>{nameIn(marker.name, language)}</span>
              <small>{marker.propertyCount} {isArabic ? "وحدات" : "listings"}</small>
            </button>
          ))}
        </div>
      )}

      {propertyList.length > 0 && (
        <div className="egypt-map-property-list" role="list" aria-label={isArabic ? "وحدات تجريبية" : "Synthetic sample properties"}>
          {propertyList.map((property) => (
            <div key={property.id} role="listitem">
              <button type="button" onClick={() => selectProperty(property)} aria-pressed={propertyId === property.id}>
                <span><strong>{nameIn(property.title, language)}</strong><small>{property.bedrooms} {isArabic ? "غرف" : "beds"} · {property.areaSqm} m²</small></span>
                <b>{formatEgp(property.priceEgp, language)}</b>
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedProperty && (
        <div className="egypt-map-selected-property" aria-live="polite">
          <strong>{nameIn(selectedProperty.title, language)}</strong>
          <span>{nameIn(selectedProperty.community.name, language)} · {selectedProperty.areaSqm} m² · {formatEgp(selectedProperty.priceEgp, language)}</span>
          <small>{isArabic ? "بيانات تجريبية وليست عرضاً حقيقياً." : "Synthetic sample only; not a live offer."}</small>
        </div>
      )}

      <p className="egypt-map-notice">{nameIn(INVENTORY_NOTICE, language)}</p>
      <footer className="egypt-map-attribution">
        {isArabic ? "الحدود الجغرافية: Natural Earth · رخصة CC0 1.0" : `Boundary: ${EGYPT_MAP_SOURCE.name} · ${EGYPT_MAP_SOURCE.license}`}
      </footer>
    </section>
  );
};
