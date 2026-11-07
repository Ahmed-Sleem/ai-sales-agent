"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EGYPT_MAP_VIEWBOX, EGYPT_LOCATION_MARKERS, EGYPT_PROPERTY_MARKERS, projectEgyptCoordinate, type EgyptLocationMarker } from "../data/egyptMap";
import { INVENTORY, type InventoryProperty, type LocalizedText } from "../data/catalogue";
import governorates from "../data/egyptGovernorates.json";
import { useApp, type MapSelection } from "../context/AppContext";
import { PropertyDetailView } from "./PropertyDetailView";

const MAP_WIDTH = 598;
const MAP_HEIGHT = 548;
const MAX_MAP_ZOOM = 28;
const DETAIL_ROADS_ZOOM = 2;
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MAP_ASSET_VERSION = "5";
const ADMIN_SCALE_X = MAP_WIDTH / 548.58221;
const ADMIN_SCALE_Y = MAP_HEIGHT / 498.86664;
const PROPERTIES_BY_ID = new Map<string, InventoryProperty>(INVENTORY.map((property) => [property.id, property] as [string, InventoryProperty]));
const CATALOG_CITY_BY_GOVERNORATE: Record<string, string> = { "EG-C": "cairo", "EG-GZ": "giza-west", "EG-ALX": "alexandria", "EG-MT": "north-coast" };

interface GovernorateShape {
  readonly id: string;
  readonly name: LocalizedText;
  readonly d: string;
}
interface MapPlace {
  readonly id: string;
  readonly name: LocalizedText;
  readonly coordinates: { latitude: number; longitude: number };
  readonly governorateId?: string;
}
const GOVERNORATE_SHAPES = governorates as readonly GovernorateShape[];
const MAJOR_PLACES: readonly MapPlace[] = [
  { id: "alexandria", name: { en: "Alexandria", ar: "الإسكندرية" }, coordinates: { latitude: 31.2001, longitude: 29.9187 }, governorateId: "EG-ALX" },
  { id: "matrouh", name: { en: "Matrouh", ar: "مطروح" }, coordinates: { latitude: 31.3543, longitude: 27.2373 }, governorateId: "EG-MT" },
  { id: "damanhur", name: { en: "Damanhur", ar: "دمنهور" }, coordinates: { latitude: 31.0341, longitude: 30.4682 }, governorateId: "EG-BH" },
  { id: "kafr-el-sheikh", name: { en: "Kafr El Sheikh", ar: "كفر الشيخ" }, coordinates: { latitude: 31.1117, longitude: 30.9399 }, governorateId: "EG-KFS" },
  { id: "damietta", name: { en: "Damietta", ar: "دمياط" }, coordinates: { latitude: 31.4175, longitude: 31.8144 }, governorateId: "EG-DT" },
  { id: "port-said", name: { en: "Port Said", ar: "بورسعيد" }, coordinates: { latitude: 31.2653, longitude: 32.3019 }, governorateId: "EG-PTS" },
  { id: "el-arish", name: { en: "El Arish", ar: "العريش" }, coordinates: { latitude: 31.1316, longitude: 33.7984 }, governorateId: "EG-SIN" },
  { id: "mansoura", name: { en: "Mansoura", ar: "المنصورة" }, coordinates: { latitude: 31.0409, longitude: 31.3785 }, governorateId: "EG-DK" },
  { id: "tanta", name: { en: "Tanta", ar: "طنطا" }, coordinates: { latitude: 30.7865, longitude: 31.0004 }, governorateId: "EG-GH" },
  { id: "zagazig", name: { en: "Zagazig", ar: "الزقازيق" }, coordinates: { latitude: 30.5877, longitude: 31.502, }, governorateId: "EG-SHR" },
  { id: "ismailia", name: { en: "Ismailia", ar: "الإسماعيلية" }, coordinates: { latitude: 30.5965, longitude: 32.2715 }, governorateId: "EG-IS" },
  { id: "cairo", name: { en: "Cairo", ar: "القاهرة" }, coordinates: { latitude: 30.0444, longitude: 31.2357 }, governorateId: "EG-C" },
  { id: "giza", name: { en: "Giza", ar: "الجيزة" }, coordinates: { latitude: 29.987, longitude: 31.2118 }, governorateId: "EG-GZ" },
  { id: "giza-west", name: { en: "Giza / West Cairo", ar: "الجيزة وغرب القاهرة" }, coordinates: { latitude: 30.035, longitude: 30.994 }, governorateId: "EG-GZ" },
  { id: "north-coast", name: { en: "North Coast", ar: "الساحل الشمالي" }, coordinates: { latitude: 30.837, longitude: 28.984 }, governorateId: "EG-MT" },
  { id: "new-cairo", name: { en: "New Cairo", ar: "القاهرة الجديدة" }, coordinates: { latitude: 30.03, longitude: 31.47 }, governorateId: "EG-C" },
  { id: "sixth-october", name: { en: "6th of October", ar: "السادس من أكتوبر" }, coordinates: { latitude: 29.93, longitude: 30.91 }, governorateId: "EG-GZ" },
  { id: "suez", name: { en: "Suez", ar: "السويس" }, coordinates: { latitude: 29.9668, longitude: 32.5498 }, governorateId: "EG-SUZ" },
  { id: "fayoum", name: { en: "Fayoum", ar: "الفيوم" }, coordinates: { latitude: 29.3084, longitude: 30.8428 }, governorateId: "EG-FYM" },
  { id: "beni-suef", name: { en: "Beni Suef", ar: "بني سويف" }, coordinates: { latitude: 29.0661, longitude: 31.0994 }, governorateId: "EG-BNS" },
  { id: "minya", name: { en: "Minya", ar: "المنيا" }, coordinates: { latitude: 28.1099, longitude: 30.7503 }, governorateId: "EG-MN" },
  { id: "asyut", name: { en: "Asyut", ar: "أسيوط" }, coordinates: { latitude: 27.1809, longitude: 31.1837 }, governorateId: "EG-AST" },
  { id: "sohag", name: { en: "Sohag", ar: "سوهاج" }, coordinates: { latitude: 26.5569, longitude: 31.6948 }, governorateId: "EG-SHG" },
  { id: "qena", name: { en: "Qena", ar: "قنا" }, coordinates: { latitude: 26.1642, longitude: 32.7267 }, governorateId: "EG-KN" },
  { id: "luxor", name: { en: "Luxor", ar: "الأقصر" }, coordinates: { latitude: 25.6872, longitude: 32.6396 }, governorateId: "EG-LX" },
  { id: "hurghada", name: { en: "Hurghada", ar: "الغردقة" }, coordinates: { latitude: 27.2579, longitude: 33.8116 }, governorateId: "EG-BA" },
  { id: "aswan", name: { en: "Aswan", ar: "أسوان" }, coordinates: { latitude: 24.0889, longitude: 32.8998 }, governorateId: "EG-ASN" },
  { id: "kom-ombo", name: { en: "Kom Ombo", ar: "كوم أمبو" }, coordinates: { latitude: 24.474, longitude: 32.946 }, governorateId: "EG-ASN" },
  { id: "kharga", name: { en: "El Kharga", ar: "الخارجة" }, coordinates: { latitude: 25.439, longitude: 30.5586 }, governorateId: "EG-WAD" },
];

const nameIn = (value: LocalizedText, language: "en" | "ar") => value[language];
const markerPoint = (coordinates: { latitude: number; longitude: number }) =>
  projectEgyptCoordinate(coordinates.latitude, coordinates.longitude, { ...EGYPT_MAP_VIEWBOX, width: MAP_WIDTH, height: MAP_HEIGHT, padding: 8 });

const svgViewMetrics = (svg: SVGSVGElement) => {
  const scale = Math.min(svg.clientWidth / MAP_WIDTH, svg.clientHeight / MAP_HEIGHT);
  return {
    scale,
    offsetX: (svg.clientWidth - MAP_WIDTH * scale) / 2,
    offsetY: (svg.clientHeight - MAP_HEIGHT * scale) / 2,
  };
};
const paintCompositorTransform = (svg: SVGSVGElement, view: { zoom: number; pan: { x: number; y: number } }) => {
  const metrics = svgViewMetrics(svg);
  const x = metrics.offsetX * (1 - view.zoom) + view.pan.x * metrics.scale;
  const y = metrics.offsetY * (1 - view.zoom) + view.pan.y * metrics.scale;
  svg.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${view.zoom})`;
};
const settleVectorTransform = (svg: SVGSVGElement | null, group: SVGGElement | null, view: { zoom: number; pan: { x: number; y: number } }) => {
  group?.setAttribute("transform", `translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`);
  if (svg) svg.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
};

export const EgyptMapView: React.FC = () => {
  const { language, vizSelection, setVizSelection, mapDirective } = useApp();
  const [cityId, setCityId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [selectedGovernorateId, setSelectedGovernorateId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<readonly string[]>([]);
  const [shortlistIds, setShortlistIds] = useState<readonly string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<readonly string[]>([]);
  const [zoom, setZoom] = useState(1);
  const markerCounterScale = 1 / zoom;
  const initialView = { zoom: 1, pan: { x: 0, y: 0 } };
  const viewRef = useRef(initialView);
  const targetViewRef = useRef(initialView);
  const transformGroupRef = useRef<SVGGElement | null>(null);
  const zoomLabelRef = useRef("1");
  const labelsVisibleRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isArabic = language === "ar";

  const cities = useMemo(() => EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "city"), []);
  const districts = useMemo(() => EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "district" && marker.cityId === cityId), [cityId]);
  const communities = useMemo(() => EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === "community" && marker.districtId === districtId), [districtId]);
  const properties = useMemo(() => EGYPT_PROPERTY_MARKERS.filter((marker) =>
    marker.cityId === cityId && marker.districtId === districtId && marker.communityId === communityId,
  ), [cityId, districtId, communityId]);
  const currentLocation = [...cities, ...districts, ...communities].find((marker) =>
    marker.cityId === cityId && (!districtId || marker.districtId === districtId) && (!communityId || marker.communityId === communityId),
  );

  const transitionView = useCallback((targetZoom: number, targetPan: { x: number; y: number }) => {
    const target = { zoom: Math.max(1, Math.min(MAX_MAP_ZOOM, targetZoom)), pan: targetPan };
    targetViewRef.current = target;
    const nextLabel = target.zoom.toFixed(1).replace(/\.0$/, "");
    const nextLabelsVisible = target.zoom > 1.22;
    if (nextLabel !== zoomLabelRef.current || nextLabelsVisible !== labelsVisibleRef.current) {
      zoomLabelRef.current = nextLabel;
      labelsVisibleRef.current = nextLabelsVisible;
      setZoom(target.zoom);
    }
    const paint = (current: typeof target) => {
      const svg = svgRef.current;
      if (!svg) return;
      // Animate a compositor layer, then hand the final view back to the vector SVG
      // so labels and roads regain full detail instead of staying bitmap-scaled.
      paintCompositorTransform(svg, current);
    };
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion) {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      viewRef.current = target;
      settleVectorTransform(svgRef.current, transformGroupRef.current, target);
      return;
    }
    // Keep one spring-like animation alive and retarget it on wheel events. The detailed
    // SVG is promoted once, not repainted by React or the browser on every input tick.
    if (animationFrameRef.current !== null) return;
    transformGroupRef.current?.setAttribute("transform", "translate(0 0) scale(1)");
    paint(viewRef.current);
    let previousTime = 0;
    const animate = (now: number) => {
      const elapsed = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
      previousTime = now;
      const current = viewRef.current;
      const latestTarget = targetViewRef.current;
      const follow = 1 - Math.exp(-elapsed / 0.105);
      const next = {
        zoom: current.zoom + (latestTarget.zoom - current.zoom) * follow,
        pan: {
          x: current.pan.x + (latestTarget.pan.x - current.pan.x) * follow,
          y: current.pan.y + (latestTarget.pan.y - current.pan.y) * follow,
        },
      };
      const settled = Math.abs(latestTarget.zoom - next.zoom) < 0.001
        && Math.abs(latestTarget.pan.x - next.pan.x) < 0.08
        && Math.abs(latestTarget.pan.y - next.pan.y) < 0.08;
      viewRef.current = settled ? latestTarget : next;
      if (settled) {
        settleVectorTransform(svgRef.current, transformGroupRef.current, latestTarget);
        animationFrameRef.current = null;
      } else {
        paint(viewRef.current);
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };
    animationFrameRef.current = window.requestAnimationFrame(animate);
  }, []);
  const mapSelectionFor = (id: string, name: string, detail: string, level: MapSelection["level"], coordinates?: { latitude: number; longitude: number }): MapSelection => ({
    id, name, detail, level, ...(coordinates ? { coordinates } : {}),
  });

  const selectLocation = (marker: EgyptLocationMarker, coordinates = marker.coordinates) => {
    if (suppressClickRef.current) return;
    setSelectedGovernorateId(null);
    setPropertyId(null);
    if (marker.level === "city") {
      setCityId(marker.cityId); setDistrictId(null); setCommunityId(null);
    } else if (marker.level === "district") {
      setCityId(marker.cityId); setDistrictId(marker.districtId ?? null); setCommunityId(null);
    } else {
      setCityId(marker.cityId); setDistrictId(marker.districtId ?? null); setCommunityId(marker.communityId ?? null);
    }
    const label = nameIn(marker.name, language);
    setVizSelection(mapSelectionFor(marker.id, label, marker.level, marker.level, coordinates));
  };

  const selectPlace = (place: MapPlace) => {
    if (suppressClickRef.current) return;
    const catalogCity = cities.find((marker) => marker.cityId === place.id);
    setSelectedGovernorateId(place.governorateId ?? null);
    if (catalogCity) {
      selectLocation(catalogCity, place.coordinates);
      return;
    }
    setCityId(null); setDistrictId(null); setCommunityId(null); setPropertyId(null);
    setVizSelection(mapSelectionFor(`place:${place.id}`, nameIn(place.name, language), isArabic ? "مدينة" : "City", "city", place.coordinates));
  };

  const selectProperty = (property: InventoryProperty) => {
    if (suppressClickRef.current) return;
    setPropertyId(property.id);
    setCityId(property.city.id); setDistrictId(property.district.id); setCommunityId(property.community.id);
    setVizSelection(mapSelectionFor(property.id, nameIn(property.title, language), `${nameIn(property.community.name, language)} · ${property.areaSqm} m²`, "property", property.coordinates));
  };

  const selectGovernorate = (region: GovernorateShape) => {
    if (suppressClickRef.current) return;
    setSelectedGovernorateId(region.id);
    setPropertyId(null); setDistrictId(null); setCommunityId(null);
    const catalogCityId = CATALOG_CITY_BY_GOVERNORATE[region.id];
    setCityId(catalogCityId ?? null);
    const label = nameIn(region.name, language);
    setVizSelection(mapSelectionFor(`governorate:${region.id}`, label, isArabic ? "محافظة" : "Governorate", "governorate"));
  };

  const resetMap = () => {
    setCityId(null); setDistrictId(null); setCommunityId(null); setPropertyId(null); setSelectedGovernorateId(null);
    setHighlightedIds([]); setShortlistIds([]); setRejectedIds([]);
    transitionView(1, { x: 0, y: 0 });
    setVizSelection(null);
  };

  useEffect(() => {
    if (!mapDirective) return;
    const frame = window.requestAnimationFrame(() => {
      const directive = mapDirective.directive;
      const path = directive.drillPath ?? [];
      const nextCity = path[0] ?? null;
      const nextDistrict = path[1] ?? null;
      const nextCommunity = path[2] ?? null;
      setCityId(nextCity); setDistrictId(nextDistrict); setCommunityId(nextCommunity);
      setHighlightedIds(directive.inspectIds ?? []);
      setShortlistIds(directive.shortlistIds ?? []);
      setRejectedIds(directive.rejectedIds ?? []);
      if (directive.focusId) {
        const focusedProperty = PROPERTIES_BY_ID.get(directive.focusId);
        if (focusedProperty) {
          setPropertyId(focusedProperty.id);
          setCityId(focusedProperty.city.id); setDistrictId(focusedProperty.district.id); setCommunityId(focusedProperty.community.id);
        } else {
          setPropertyId(null);
        }
      } else {
        setPropertyId(null);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mapDirective]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const svg = event.currentTarget;
    const viewport = svg.parentElement;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const metrics = svgViewMetrics(svg);
    const localX = (event.clientX - rect.left - viewport.clientLeft - metrics.offsetX) / metrics.scale;
    const localY = (event.clientY - rect.top - viewport.clientTop - metrics.offsetY) / metrics.scale;
    const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * rect.height : event.deltaY;
    const boundedDelta = Math.max(-220, Math.min(220, pixels));
    const displayed = viewRef.current;
    const targetZoom = targetViewRef.current.zoom;
    const nextZoom = Math.max(1, Math.min(MAX_MAP_ZOOM, targetZoom * Math.exp(-boundedDelta * 0.00135)));
    const pointX = (localX - displayed.pan.x) / displayed.zoom;
    const pointY = (localY - displayed.pan.y) / displayed.zoom;
    transitionView(nextZoom, {
      x: localX - pointX * nextZoom,
      y: localY - pointY * nextZoom,
    });
  };
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    targetViewRef.current = viewRef.current;
    transformGroupRef.current?.setAttribute("transform", "translate(0 0) scale(1)");
    if (svgRef.current) paintCompositorTransform(svgRef.current, viewRef.current);
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, moved: false };
  };
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const scale = svgViewMetrics(event.currentTarget).scale;
    const dx = (event.clientX - pointer.x) / (scale * viewRef.current.zoom);
    const dy = (event.clientY - pointer.y) / (scale * viewRef.current.zoom);
    if (!pointer.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      pointer.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (pointer.moved) {
      const next = { zoom: viewRef.current.zoom, pan: { x: pointer.panX + dx, y: pointer.panY + dy } };
      viewRef.current = next;
      targetViewRef.current = next;
      const svg = svgRef.current;
      if (svg) paintCompositorTransform(svg, next);
    }
  };
  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current;
    if (pointer?.id === event.pointerId && pointer.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 120);
    }
    pointerRef.current = null;
    settleVectorTransform(svgRef.current, transformGroupRef.current, viewRef.current);
  };
  const zoomBy = (amount: number) => {
    const current = targetViewRef.current;
    const nextZoom = Math.max(1, Math.min(MAX_MAP_ZOOM, current.zoom * Math.exp(amount * 0.86)));
    const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    const ratio = nextZoom / current.zoom;
    transitionView(nextZoom, {
      x: center.x - (center.x - current.pan.x) * ratio,
      y: center.y - (center.y - current.pan.y) * ratio,
    });
  };

  const regionCityId = (regionId: string) => CATALOG_CITY_BY_GOVERNORATE[regionId];
  const selectedRegionName = GOVERNORATE_SHAPES.find((region) => region.id === selectedGovernorateId);
  const currentName = currentLocation ? nameIn(currentLocation.name, language) : selectedRegionName ? nameIn(selectedRegionName.name, language) : null;

  const placeLabel = (place: MapPlace, index: number) => {
    const point = markerPoint(place.coordinates);
    const catalogMarker = cities.find((marker) => marker.cityId === place.id);
    const active = vizSelection?.id === `place:${place.id}` || (catalogMarker && vizSelection?.id === catalogMarker.id) || highlightedIds.includes(place.id) || Boolean(catalogMarker && highlightedIds.includes(catalogMarker.cityId));
    const showLabel = zoom > 1.22 || ["cairo", "alexandria", "giza", "giza-west", "north-coast", "luxor", "aswan", "suez", "matrouh"].includes(place.id);
    if (!showLabel) return null;
    return (
      <g key={place.id} transform={`translate(${point.x} ${point.y}) scale(${markerCounterScale}) translate(${-point.x} ${-point.y})`} className={`map-place ${active ? "selected" : ""}`} role="button" tabIndex={0}
        aria-label={`${nameIn(place.name, language)}${catalogMarker ? `, ${catalogMarker.propertyCount} ${isArabic ? "وحدات توضيحية" : "illustrative listings"}` : ""}`}
        data-map-location-id={place.id}
        onClick={() => catalogMarker ? selectLocation(catalogMarker, place.coordinates) : selectPlace(place)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPlace(place); } }}>
        <title>{nameIn(place.name, language)}</title>
        {catalogMarker ? <circle className="map-place-glow" cx={point.x} cy={point.y} r={active ? 17 : 12} /> : null}
        <circle cx={point.x} cy={point.y} r={active ? 6.5 : catalogMarker ? 5 : 2.2} className={catalogMarker ? "map-place-dot inventory" : "map-place-dot"} />
        <text x={point.x + 8} y={point.y + (index % 2 ? 10 : -7)} className="map-place-label" pointerEvents="none">{nameIn(place.name, language)}</text>
        {catalogMarker ? <text x={point.x} y={point.y + 2.5} className="map-place-count" textAnchor="middle" pointerEvents="none">{Math.min(catalogMarker.propertyCount, 99)}</text> : null}
      </g>
    );
  };

  const locationMarker = (marker: EgyptLocationMarker, index: number) => {
    const point = markerPoint(marker.coordinates);
    const active = vizSelection?.id === marker.id || highlightedIds.includes(marker.id) || highlightedIds.includes(marker.cityId) || Boolean(marker.districtId && highlightedIds.includes(marker.districtId)) || Boolean(marker.communityId && highlightedIds.includes(marker.communityId)) || marker.propertyIds.some((id) => highlightedIds.includes(id));
    const shortlisted = marker.propertyIds.some((id) => shortlistIds.includes(id));
    const rejected = marker.propertyIds.some((id) => rejectedIds.includes(id));
    return (
      <g key={marker.id} transform={`translate(${point.x} ${point.y}) scale(${markerCounterScale}) translate(${-point.x} ${-point.y})`} className={`map-cluster ${active ? "highlighted" : ""} ${shortlisted ? "shortlisted" : ""} ${rejected ? "rejected" : ""}`} role="button" tabIndex={0}
        aria-label={`${nameIn(marker.name, language)}, ${marker.propertyCount} ${isArabic ? "وحدات توضيحية" : "illustrative listings"}`}
        data-map-location-id={marker.id} onClick={() => selectLocation(marker)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLocation(marker); } }}>
        <title>{`${nameIn(marker.name, language)} · ${marker.propertyCount}`}</title>
        <circle cx={point.x} cy={point.y} r={active ? 22 : 15} className="map-cluster-ring" />
        <circle cx={point.x} cy={point.y} r={active ? 8 : 6} className="map-cluster-dot" />
        <text x={point.x + 11} y={point.y - 9 + (index % 2 ? 10 : 0)} className="map-cluster-label" pointerEvents="none">{nameIn(marker.name, language)}</text>
        <text x={point.x} y={point.y + 2.5} className="map-cluster-count" textAnchor="middle" pointerEvents="none">{Math.min(marker.propertyCount, 99)}</text>
      </g>
    );
  };

  const propertyMarker = (marker: (typeof EGYPT_PROPERTY_MARKERS)[number], index: number) => {
    const property = PROPERTIES_BY_ID.get(marker.id);
    if (!property) return null;
    const point = markerPoint(marker.coordinates);
    const selected = propertyId === property.id || vizSelection?.id === property.id || highlightedIds.includes(property.id);
    const shortlisted = shortlistIds.includes(property.id);
    const rejected = rejectedIds.includes(property.id);
    return (
      <g key={property.id} transform={`translate(${point.x} ${point.y}) scale(${markerCounterScale}) translate(${-point.x} ${-point.y})`} className={`map-property ${selected ? "selected" : ""} ${shortlisted ? "shortlisted" : ""} ${rejected ? "rejected" : ""}`} role="button" tabIndex={0}
        aria-label={`${nameIn(property.title, language)}, ${property.areaSqm} ${isArabic ? "متر مربع" : "square metres"}`}
        data-map-location-id={property.id} onClick={() => selectProperty(property)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectProperty(property); } }}>
        <title>{nameIn(property.title, language)}</title>
        <circle cx={point.x} cy={point.y} r={selected ? 11 : 7} className="map-property-dot" />
        <path d={`M${point.x - 3.2} ${point.y + 3.5}V${point.y - 1.3}L${point.x} ${point.y - 3.8}L${point.x + 3.2} ${point.y - 1.3}V${point.y + 3.5}Z`} className="map-building-glyph" pointerEvents="none" />
        <path d={`M${point.x - 1.2} ${point.y + 3.5}V${point.y + 0.8}H${point.x + 1.2}V${point.y + 3.5}M${point.x - 1.8} ${point.y - 0.5}H${point.x - 1.1}M${point.x + 1.1} ${point.y - 0.5}H${point.x + 1.8}`} className="map-building-detail" pointerEvents="none" />
        {zoom > 2.5 || selected ? <text x={point.x + 10} y={point.y + (index % 2 ? 10 : -8)} className="map-place-label" pointerEvents="none">{nameIn(property.title, language)}</text> : null}
      </g>
    );
  };

  const visiblePropertyMarkers = properties.map((marker, index) => propertyMarker(marker, index));
  const selectedProperty = propertyId ? PROPERTIES_BY_ID.get(propertyId) : null;
  if (selectedProperty) {
    return <PropertyDetailView property={selectedProperty} onBack={() => setPropertyId(null)} />;
  }
  const secondaryPlaces = !cityId ? MAJOR_PLACES : [];
  const coordsLabel = zoom.toFixed(1).replace(/\.0$/, "");

  return (
    <section className="egypt-map-panel" aria-label={isArabic ? "خريطة تفاعلية لمصر" : "Interactive Egypt map"}>
      <div className="egypt-map-viewport" aria-label={isArabic ? "خريطة تفاعلية قابلة للتكبير والتحريك" : "Interactive zoomable, pannable map"}>
        <svg ref={svgRef} className="egypt-map-svg" style={{ transform: "translate3d(0px, 0px, 0px) scale(1)" }} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group"
          aria-label={isArabic ? "خريطة مصر والطرق والمناطق" : "Egypt roads and administrative areas"}
          onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
          <defs>
            <linearGradient id="map-vignette" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#091523" stopOpacity=".1"/><stop offset="1" stopColor="#06101a" stopOpacity=".22"/></linearGradient>
            <filter id="map-marker-shadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#02070d" floodOpacity=".75"/></filter>
          </defs>
          <g ref={transformGroupRef} className="map-view-transform" transform="translate(0 0) scale(1)">
            <image className="map-osm-basemap" href={`${PUBLIC_BASE_PATH}/maps/egypt-openstreetmap.svg?v=${MAP_ASSET_VERSION}`} x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" aria-hidden="true" />
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-vignette)" pointerEvents="none" />
            {zoom >= DETAIL_ROADS_ZOOM ? <image className="map-detail-basemap" href={`${PUBLIC_BASE_PATH}/maps/egypt-city-roads.svg?v=${MAP_ASSET_VERSION}`} x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" aria-hidden="true" /> : null}
            <g className="map-governorates" transform={`scale(${ADMIN_SCALE_X} ${ADMIN_SCALE_Y})`}>
              {GOVERNORATE_SHAPES.map((region) => {
                const selected = selectedGovernorateId === region.id || Boolean(regionCityId(region.id) && cityId === regionCityId(region.id));
                return <path key={region.id} d={region.d} role="button" tabIndex={0}
                  className={`map-governorate-shape ${selected ? "selected" : ""}`}
                  aria-label={`${nameIn(region.name, language)} ${isArabic ? "محافظة" : "governorate"}`}
                  data-governorate-id={region.id}
                  onClick={() => selectGovernorate(region)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectGovernorate(region); } }}>
                  <title>{nameIn(region.name, language)}</title>
                </path>;
              })}
            </g>
            {!cityId ? secondaryPlaces.map(placeLabel) : null}
            {cityId && !districtId ? districts.map(locationMarker) : null}
            {districtId && !communityId ? communities.map(locationMarker) : null}
            {communityId ? visiblePropertyMarkers : null}
          </g>
        </svg>

        <div className="map-control-stack" role="group" aria-label={isArabic ? "عناصر التحكم في الخريطة" : "Map controls"}>
          <button type="button" aria-label={isArabic ? "تكبير الخريطة" : "Zoom in"} title={isArabic ? "تكبير" : "Zoom in"} onClick={() => zoomBy(0.35)}>+</button>
          <span aria-live="polite">{coordsLabel}×</span>
          <button type="button" aria-label={isArabic ? "تصغير الخريطة" : "Zoom out"} title={isArabic ? "تصغير" : "Zoom out"} onClick={() => zoomBy(-0.35)}>−</button>
          <button type="button" aria-label={isArabic ? "إعادة ضبط عرض الخريطة" : "Reset map view"} title={isArabic ? "إعادة ضبط" : "Reset view"} onClick={resetMap}><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>
        </div>

        {currentName ? <div className="map-focus-label" aria-live="polite">{currentName}</div> : null}
        {selectedProperty ? <div className="map-focus-property" aria-live="polite"><strong>{nameIn(selectedProperty.title, language)}</strong><span>{selectedProperty.areaSqm} m² · {selectedProperty.bedrooms} {isArabic ? "غرف" : "beds"}</span><small>{isArabic ? "وحدة توضيحية" : "Illustrative sample unit"}</small></div> : null}
        <div className="map-synthetic-legend"><span aria-hidden="true" />{isArabic ? "المخزون العقاري توضيحي" : "Illustrative property inventory"}</div>
        <a className="map-osm-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" aria-label={isArabic ? "مساهمو OpenStreetMap، رخصة ODbL" : "OpenStreetMap contributors, ODbL"}>© OpenStreetMap</a>
      </div>
    </section>
  );
};
