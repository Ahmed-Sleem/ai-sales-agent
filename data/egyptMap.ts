/**
 * Local Natural Earth Egypt geometry, SVG projection, catalogue-derived area/property markers,
 * and point-in-country validation. Rendering stays offline and separate from this data module.
 */
import egyptFeatureCollection from './egypt.geo.json';
import { INVENTORY, type InventoryProperty, type LocalizedText } from './catalogue';

export type EgyptPosition = readonly [longitude: number, latitude: number];
export type EgyptLinearRing = readonly EgyptPosition[];
export type EgyptPolygonCoordinates = readonly EgyptLinearRing[];
export type EgyptGeometry =
  | Readonly<{ type: 'Polygon'; coordinates: EgyptPolygonCoordinates }>
  | Readonly<{ type: 'MultiPolygon'; coordinates: readonly EgyptPolygonCoordinates[] }>;
export interface EgyptBounds {
  readonly minLongitude: number;
  readonly minLatitude: number;
  readonly maxLongitude: number;
  readonly maxLatitude: number;
}
export interface SvgPoint {
  readonly x: number;
  readonly y: number;
}
export interface SvgViewBox {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}
export interface MapCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}
export type EgyptLocationLevel = 'city' | 'district' | 'community';
export interface EgyptLocationMarker {
  readonly id: string;
  readonly level: EgyptLocationLevel;
  readonly name: LocalizedText;
  readonly cityId: string;
  readonly cityName: LocalizedText;
  readonly districtId?: string;
  readonly districtName?: LocalizedText;
  readonly communityId?: string;
  readonly propertyIds: readonly string[];
  readonly propertyCount: number;
  readonly coordinates: MapCoordinates;
  readonly synthetic: true;
}
export interface EgyptPropertyMarker {
  readonly id: string;
  readonly name: LocalizedText;
  readonly propertyType: InventoryProperty['propertyType'];
  readonly cityId: string;
  readonly districtId: string;
  readonly communityId: string;
  readonly coordinates: MapCoordinates;
  readonly synthetic: true;
}

interface GeoJsonFeature {
  readonly type: 'Feature';
  readonly properties: Readonly<{ ADMIN: string; NAME: string; ADM0_A3: string; ISO_A3: string }>;
  readonly geometry: EgyptGeometry;
}
const feature = (egyptFeatureCollection as unknown as { features: GeoJsonFeature[] }).features[0];
export const EGYPT_GEOMETRY = feature.geometry;
export const EGYPT_MAP_SOURCE = Object.freeze({
  name: 'Natural Earth 1:50m Admin-0 Countries, v4.0.0-era layer',
  feature: feature.properties.ADMIN,
  sourceUrl: 'https://github.com/martynafford/natural-earth-geojson/blob/90266457d82d3717e47313e72a921e31a087d2c4/50m/cultural/ne_50m_admin_0_countries.json',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://github.com/martynafford/natural-earth-geojson/blob/8e23b9101397f587d5ec3dd44eeb4bad4d88faa9/licence',
});
export const EGYPT_MAP_VIEWBOX: Readonly<SvgViewBox> = Object.freeze({ width: 720, height: 560, padding: 24 });

function polygonsOf(geometry: EgyptGeometry): readonly EgyptPolygonCoordinates[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}
function positionsOf(geometry: EgyptGeometry): EgyptPosition[] {
  return polygonsOf(geometry).flatMap((polygon) => polygon.flatMap((ring) => [...ring]));
}

const allPositions = positionsOf(EGYPT_GEOMETRY);
const latitudes = allPositions.map((position) => position[1]);
const longitudes = allPositions.map((position) => position[0]);
export const EGYPT_MAP_BOUNDS: EgyptBounds = Object.freeze({
  minLongitude: Math.min(...longitudes),
  minLatitude: Math.min(...latitudes),
  maxLongitude: Math.max(...longitudes),
  maxLatitude: Math.max(...latitudes),
});

const centerLatitudeRadians = ((EGYPT_MAP_BOUNDS.minLatitude + EGYPT_MAP_BOUNDS.maxLatitude) / 2) * Math.PI / 180;
const longitudeScale = Math.cos(centerLatitudeRadians);
const projectedBoundary = allPositions.map(([longitude, latitude]) => ({ x: longitude * longitudeScale, y: latitude }));
const projectedBounds = {
  minX: Math.min(...projectedBoundary.map((point) => point.x)),
  maxX: Math.max(...projectedBoundary.map((point) => point.x)),
  minY: Math.min(...projectedBoundary.map((point) => point.y)),
  maxY: Math.max(...projectedBoundary.map((point) => point.y)),
};

function roundSvg(value: number): number {
  return Math.round(value * 100) / 100;
}
function projectPosition(longitude: number, latitude: number, width: number, height: number, padding: number): SvgPoint {
  if (![longitude, latitude, width, height, padding].every(Number.isFinite) || width <= 0 || height <= 0 || padding < 0 || padding * 2 >= Math.min(width, height)) {
    throw new RangeError('SVG projection requires finite coordinates and positive dimensions with valid padding');
  }
  const availableWidth = width - 2 * padding;
  const availableHeight = height - 2 * padding;
  const scale = Math.min(availableWidth / (projectedBounds.maxX - projectedBounds.minX), availableHeight / (projectedBounds.maxY - projectedBounds.minY));
  const contentWidth = (projectedBounds.maxX - projectedBounds.minX) * scale;
  const contentHeight = (projectedBounds.maxY - projectedBounds.minY) * scale;
  const offsetX = (width - contentWidth) / 2;
  const offsetY = (height - contentHeight) / 2;
  const xProjected = longitude * longitudeScale;
  return {
    x: roundSvg(offsetX + (xProjected - projectedBounds.minX) * scale),
    y: roundSvg(height - offsetY - (latitude - projectedBounds.minY) * scale),
  };
}

/** Project geographic longitude/latitude to the local Egypt SVG viewBox. */
export function projectEgyptCoordinate(latitude: number, longitude: number, options: SvgViewBox = EGYPT_MAP_VIEWBOX): SvgPoint {
  return projectPosition(longitude, latitude, options.width, options.height, options.padding);
}

/** Return an SVG path string from the local polygon, preserving all rings and holes. */
export function projectEgyptGeometry(options: SvgViewBox = EGYPT_MAP_VIEWBOX): string {
  return polygonsOf(EGYPT_GEOMETRY).flatMap((polygon) => polygon.map((ring) => {
    const segments = ring.map(([longitude, latitude], index) => {
      const point = projectPosition(longitude, latitude, options.width, options.height, options.padding);
      return `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`;
    });
    return `${segments.join(' ')} Z`;
  })).join(' ');
}
export const EGYPT_SVG_PATH = projectEgyptGeometry();

function pointOnSegment(longitude: number, latitude: number, a: EgyptPosition, b: EgyptPosition): boolean {
  const cross = (longitude - a[0]) * (b[1] - a[1]) - (latitude - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > 1e-9) return false;
  return longitude >= Math.min(a[0], b[0]) - 1e-9 && longitude <= Math.max(a[0], b[0]) + 1e-9 &&
    latitude >= Math.min(a[1], b[1]) - 1e-9 && latitude <= Math.max(a[1], b[1]) + 1e-9;
}
function pointInRing(longitude: number, latitude: number, ring: EgyptLinearRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (pointOnSegment(longitude, latitude, a, b)) return true;
    const crossesLatitude = (a[1] > latitude) !== (b[1] > latitude);
    if (crossesLatitude && longitude < ((b[0] - a[0]) * (latitude - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function pointInPolygon(longitude: number, latitude: number, polygon: EgyptPolygonCoordinates): boolean {
  return Boolean(polygon[0] && pointInRing(longitude, latitude, polygon[0])) && !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole));
}

/** Check a geographic point against the Egypt polygon (edges count as inside). */
export function isCoordinateInsideEgypt(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    longitude < EGYPT_MAP_BOUNDS.minLongitude || longitude > EGYPT_MAP_BOUNDS.maxLongitude ||
    latitude < EGYPT_MAP_BOUNDS.minLatitude || latitude > EGYPT_MAP_BOUNDS.maxLatitude) return false;
  return polygonsOf(EGYPT_GEOMETRY).some((polygon) => pointInPolygon(longitude, latitude, polygon));
}

function averageCoordinates(properties: readonly InventoryProperty[]): MapCoordinates {
  return {
    latitude: properties.reduce((sum, property) => sum + property.coordinates.latitude, 0) / properties.length,
    longitude: properties.reduce((sum, property) => sum + property.coordinates.longitude, 0) / properties.length,
  };
}
function groupProperties(properties: readonly InventoryProperty[], key: (property: InventoryProperty) => string): Map<string, InventoryProperty[]> {
  const groups = new Map<string, InventoryProperty[]>();
  for (const property of properties) {
    const id = key(property);
    const group = groups.get(id) ?? [];
    group.push(property);
    groups.set(id, group);
  }
  return groups;
}
function makeLocationMarker(level: EgyptLocationLevel, properties: readonly InventoryProperty[]): EgyptLocationMarker {
  const first = properties[0];
  if (level === 'city') {
    return {
      id: `city:${first.city.id}`, level, name: first.city.name, cityId: first.city.id, cityName: first.city.name,
      propertyIds: properties.map((property) => property.id), propertyCount: properties.length,
      coordinates: averageCoordinates(properties), synthetic: true,
    };
  }
  if (level === 'district') {
    return {
      id: `district:${first.district.id}`, level, name: first.district.name, cityId: first.city.id, cityName: first.city.name,
      districtId: first.district.id, districtName: first.district.name,
      propertyIds: properties.map((property) => property.id), propertyCount: properties.length,
      coordinates: averageCoordinates(properties), synthetic: true,
    };
  }
  return {
    id: `community:${first.community.id}`, level, name: first.community.name, cityId: first.city.id, cityName: first.city.name,
    districtId: first.district.id, districtName: first.district.name, communityId: first.community.id,
    propertyIds: properties.map((property) => property.id), propertyCount: properties.length,
    coordinates: averageCoordinates(properties), synthetic: true,
  };
}

/** City, district, and community markers are grouped from the one canonical property inventory. */
export const EGYPT_LOCATION_MARKERS: readonly EgyptLocationMarker[] = [
  ...[...groupProperties(INVENTORY, (property) => property.city.id).values()].map((items) => makeLocationMarker('city', items)),
  ...[...groupProperties(INVENTORY, (property) => property.district.id).values()].map((items) => makeLocationMarker('district', items)),
  ...[...groupProperties(INVENTORY, (property) => property.community.id).values()].map((items) => makeLocationMarker('community', items)),
];
export const EGYPT_PROPERTY_MARKERS: readonly EgyptPropertyMarker[] = INVENTORY.map((property) => ({
  id: property.id,
  name: property.title,
  propertyType: property.propertyType,
  cityId: property.city.id,
  districtId: property.district.id,
  communityId: property.community.id,
  coordinates: property.coordinates,
  synthetic: true,
}));

/** Validate the filtered country geometry and all catalogue-derived map marker references. */
export function validateEgyptMapData(): string[] {
  const errors: string[] = [];
  if (feature.properties.ADMIN !== 'Egypt' || feature.properties.ADM0_A3 !== 'EGY') errors.push('wrong-country-feature');
  if (allPositions.length < 4 || !allPositions.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90)) {
    errors.push('invalid-geometry-coordinates');
  }
  for (const polygon of polygonsOf(EGYPT_GEOMETRY)) {
    for (const ring of polygon) {
      if (ring.length < 4 || ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) errors.push('unclosed-or-short-ring');
    }
  }
  if (EGYPT_SVG_PATH.length === 0 || /NaN|Infinity/.test(EGYPT_SVG_PATH)) errors.push('invalid-svg-projection');
  for (const marker of [...EGYPT_LOCATION_MARKERS, ...EGYPT_PROPERTY_MARKERS]) {
    if (!isCoordinateInsideEgypt(marker.coordinates.latitude, marker.coordinates.longitude)) errors.push(`marker-outside-egypt:${marker.id}`);
    if ('propertyIds' in marker && marker.propertyIds.some((id) => !INVENTORY.some((property) => property.id === id))) errors.push(`unknown-location-property:${marker.id}`);
  }
  if (EGYPT_PROPERTY_MARKERS.length !== INVENTORY.length || EGYPT_PROPERTY_MARKERS.some((marker) => !INVENTORY.some((property) => property.id === marker.id))) {
    errors.push('property-marker-inventory-mismatch');
  }
  return errors;
}
