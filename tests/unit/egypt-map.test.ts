import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import {
  EGYPT_GEOMETRY,
  EGYPT_LOCATION_MARKERS,
  EGYPT_MAP_BOUNDS,
  EGYPT_MAP_SOURCE,
  EGYPT_MAP_VIEWBOX,
  EGYPT_PROPERTY_MARKERS,
  EGYPT_SVG_PATH,
  isCoordinateInsideEgypt,
  projectEgyptCoordinate,
  projectEgyptGeometry,
  validateEgyptMapData,
} from '../../data/egyptMap';

describe('local Egypt map geometry and catalogue-derived markers', () => {
  it('loads the single local Natural Earth Egypt feature with recorded public-domain provenance', () => {
    expect(EGYPT_GEOMETRY.type).toBe('Polygon');
    expect(EGYPT_MAP_SOURCE).toMatchObject({ feature: 'Egypt', license: 'CC0 1.0 Universal' });
    expect(EGYPT_MAP_SOURCE.sourceUrl).toContain('/90266457d82d3717e47313e72a921e31a087d2c4/');
    expect(EGYPT_MAP_SOURCE.licenseUrl).toContain('/8e23b9101397f587d5ec3dd44eeb4bad4d88faa9/');
    expect(EGYPT_MAP_BOUNDS.minLongitude).toBeGreaterThan(24);
    expect(EGYPT_MAP_BOUNDS.maxLongitude).toBeLessThan(38);
    expect(EGYPT_MAP_BOUNDS.minLatitude).toBeGreaterThan(21);
    expect(EGYPT_MAP_BOUNDS.maxLatitude).toBeLessThan(33);
  });

  it('validates closed country rings and every catalogue-derived map marker', () => {
    expect(validateEgyptMapData()).toEqual([]);
    expect(EGYPT_PROPERTY_MARKERS).toHaveLength(INVENTORY.length);
    expect(EGYPT_PROPERTY_MARKERS.every((marker) => marker.synthetic)).toBe(true);
    expect(EGYPT_LOCATION_MARKERS.every((marker) => marker.synthetic && marker.propertyCount === marker.propertyIds.length)).toBe(true);
  });

  it('keeps every property and area marker inside Egypt', () => {
    expect(EGYPT_PROPERTY_MARKERS.every((marker) => isCoordinateInsideEgypt(marker.coordinates.latitude, marker.coordinates.longitude))).toBe(true);
    expect(EGYPT_LOCATION_MARKERS.every((marker) => isCoordinateInsideEgypt(marker.coordinates.latitude, marker.coordinates.longitude))).toBe(true);
    expect(isCoordinateInsideEgypt(0, 0)).toBe(false);
    expect(isCoordinateInsideEgypt(25, 36.5)).toBe(false);
    expect(isCoordinateInsideEgypt(Number.NaN, 31)).toBe(false);
  });

  it('derives city, district, and community marker groups from the canonical inventory', () => {
    const distinct = (key: 'city' | 'district' | 'community') => new Set(INVENTORY.map((property) => property[key].id)).size;
    expect(EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === 'city')).toHaveLength(distinct('city'));
    expect(EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === 'district')).toHaveLength(distinct('district'));
    expect(EGYPT_LOCATION_MARKERS.filter((marker) => marker.level === 'community')).toHaveLength(distinct('community'));
    expect(EGYPT_LOCATION_MARKERS.reduce((sum, marker) => sum + marker.propertyCount, 0)).toBe(
      INVENTORY.length * 3,
    );
  });

  it('derives each property marker ID and location from the inventory', () => {
    for (const property of INVENTORY) {
      const marker = EGYPT_PROPERTY_MARKERS.find((item) => item.id === property.id);
      expect(marker).toMatchObject({
        name: property.title,
        cityId: property.city.id,
        districtId: property.district.id,
        communityId: property.community.id,
        coordinates: property.coordinates,
      });
    }
  });

  it('projects the local polygon and points into a finite padded SVG viewBox', () => {
    expect(EGYPT_SVG_PATH.startsWith('M')).toBe(true);
    expect(EGYPT_SVG_PATH).toContain('Z');
    expect(/NaN|Infinity/.test(EGYPT_SVG_PATH)).toBe(false);
    for (const property of INVENTORY) {
      const point = projectEgyptCoordinate(property.coordinates.latitude, property.coordinates.longitude);
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(EGYPT_MAP_VIEWBOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(EGYPT_MAP_VIEWBOX.height);
    }
    expect(projectEgyptGeometry({ width: 360, height: 280, padding: 12 })).toContain('M');
  });

  it('rejects invalid projection dimensions instead of emitting a corrupt path', () => {
    expect(() => projectEgyptGeometry({ width: 0, height: 300, padding: 12 })).toThrow('SVG projection requires finite coordinates');
    expect(() => projectEgyptCoordinate(30, 31, { width: 100, height: 100, padding: 60 })).toThrow('SVG projection requires finite coordinates');
  });
});
