import { INVENTORY, type InventoryProperty, type PropertyType } from '../data/catalogue';
import { TREE, type Compound, fmtPrice } from '../data/hierarchy';
import { searchCatalogue, type SearchRequest } from './catalogueSearch';

export interface SearchFilters {
  city?: string;
  district?: string;
  compound?: string;
  cityId?: string;
  districtId?: string;
  communityId?: string;
  minBeds?: number;
  maxPrice?: number;
  minPrice?: number;
  minBua?: number;
  minLand?: number;
  typeKeyword?: string;
  propertyType?: PropertyType;
  finishing?: string;
  deliveryBefore?: string;
  strictBudget?: boolean;
  strictBedrooms?: boolean;
  strictArea?: boolean;
  excludeIds?: string[];
}
export interface VizDirective { drillPath?: string[]; inspectIds?: string[]; shortlistIds?: string[]; rejectedIds?: string[]; focusId?: string; }
export interface ToolOutcome { result: unknown; viz?: VizDirective; status: string; }

function propertyCard(property: InventoryProperty) {
  return {
    id: property.id,
    name: property.title.en,
    nameAr: property.title.ar,
    propertyType: property.propertyType,
    community: property.community.name.en,
    communityAr: property.community.name.ar,
    district: property.district.name.en,
    districtAr: property.district.name.ar,
    city: property.city.name.en,
    cityAr: property.city.name.ar,
    price: fmtPrice(property.priceEgp),
    priceEGP: property.priceEgp,
    beds: property.bedrooms,
    bua: property.areaSqm,
    land: property.landAreaSqm ?? null,
    finishing: property.finishing.en,
    finishingAr: property.finishing.ar,
    delivery: String(property.deliveryYear),
    coordinates: property.coordinates,
    photo: property.photos[0] ?? null,
    synthetic: property.synthetic,
  };
}

function lowestPrice(properties: readonly InventoryProperty[]): number | null {
  return properties.length ? Math.min(...properties.map((property) => property.priceEgp)) : null;
}

/** Browse locations; at the final level, return one best-matching property, never a list of homes. */
export function toolListLevel(path: string[] = []): ToolOutcome {
  if (path.length === 0) {
    const items = TREE.map((city) => {
      const records = INVENTORY.filter((property) => property.city.id === city.id);
      const fromPrice = lowestPrice(records);
      return {
        id: city.id,
        name: city.name,
        nameAr: city.nameAr,
        districts: city.districts.length,
        communities: city.districts.reduce((count, district) => count + district.compounds.length, 0),
        units: records.length,
        fromPrice: fromPrice === null ? null : fmtPrice(fromPrice),
      };
    });
    return { status: `Browsing Egypt — ${items.length} regions`, viz: { drillPath: [], inspectIds: items.map((item) => item.id) }, result: { stage: 'cities', items } };
  }

  const city = TREE.find((item) => item.id === path[0]);
  if (!city) return { status: 'Unknown city', result: { error: 'city not found', validCityIds: TREE.map((item) => item.id) } };
  if (path.length === 1) {
    const items = city.districts.map((district) => {
      const records = INVENTORY.filter((property) => property.district.id === district.id);
      const fromPrice = lowestPrice(records);
      return { id: district.id, name: district.name, nameAr: district.nameAr, communities: district.compounds.length, units: records.length, fromPrice: fromPrice === null ? null : fmtPrice(fromPrice) };
    });
    return { status: `Browsing ${city.name} — ${items.length} areas`, viz: { drillPath: [city.id], inspectIds: items.map((item) => item.id) }, result: { stage: 'districts', city: city.name, items } };
  }

  const district = city.districts.find((item) => item.id === path[1]);
  if (!district) return { status: 'Unknown district', result: { error: 'district not found', validDistrictIds: city.districts.map((item) => item.id) } };
  if (path.length === 2) {
    const items = district.compounds.map((community: Compound) => ({
      id: community.id,
      name: community.name,
      nameAr: community.nameAr,
      units: community.units.length,
      fromPrice: fmtPrice(community.fromPrice),
    }));
    return { status: `Browsing ${district.name} — ${items.length} communities`, viz: { drillPath: [city.id, district.id], inspectIds: items.map((item) => item.id) }, result: { stage: 'communities', district: district.name, items } };
  }

  if (path.length !== 3) return { status: 'Invalid hierarchy path', result: { error: 'path must contain at most city, district, and community IDs' } };
  const community = district.compounds.find((item) => item.id === path[2]);
  if (!community) return { status: 'Unknown community', result: { error: 'community not found', validCommunityIds: district.compounds.map((item) => item.id) } };
  const outcome = toolSearchUnits({ cityId: city.id, districtId: district.id, communityId: community.id });
  const search = outcome.result as Record<string, unknown>;
  return { ...outcome, result: { stage: 'best-match', ...search } };
}

/** Exhaustive search over the catalogue; only the single closest property is returned. */
export function toolSearchUnits(filters: SearchFilters, relax = false): ToolOutcome {
  const request: SearchRequest = {
    cityId: filters.cityId,
    districtId: filters.districtId,
    communityId: filters.communityId,
    city: filters.city,
    district: filters.district,
    community: filters.compound,
    maxBudgetEgp: filters.maxPrice,
    minBudgetEgp: filters.minPrice,
    minAreaSqm: filters.minBua,
    minBedrooms: filters.minBeds,
    minLandAreaSqm: filters.minLand,
    propertyType: filters.propertyType,
    typeKeyword: filters.typeKeyword,
    finishing: filters.finishing,
    deliveryBeforeYear: filters.deliveryBefore === undefined ? undefined : Number(filters.deliveryBefore),
    excludeIds: filters.excludeIds,
    strictBudget: filters.strictBudget,
    strictArea: filters.strictArea,
    strictBedrooms: filters.strictBedrooms,
    allowRelaxation: relax,
  };
  const result = searchCatalogue(request);
  const match = result.bestMatch;
  const viz = match
    ? { drillPath: [match.city.id, match.district.id, match.community.id], shortlistIds: [match.id], focusId: match.id }
    : {};
  const status = result.errors.length
    ? `Invalid search criteria — ${result.errors.join('; ')}`
    : match
      ? `Searched all ${result.scannedCount} properties — returned one closest match${result.relaxationsApplied.length ? ' with disclosed relaxations' : ''}`
      : `Searched all ${result.scannedCount} properties — no matching property`;
  return {
    status,
    viz,
    result: {
      scannedTotal: result.scannedCount,
      matchedCount: result.matchedCount,
      bestMatch: match ? propertyCard(match) : null,
      relaxationsApplied: result.relaxationsApplied,
      relaxationsAttempted: result.relaxationsAttempted,
      validationErrors: result.errors,
    },
  };
}

export function toolGetUnit(id: string): ToolOutcome {
  const property = INVENTORY.find((item) => item.id === id);
  if (!property) return { status: 'Property not found', result: { error: 'unknown property id', id } };
  const card = propertyCard(property);
  return {
    status: `Opening ${card.name} — ${card.community}`,
    viz: { drillPath: [property.city.id, property.district.id, property.community.id], focusId: property.id, shortlistIds: [property.id] },
    result: card,
  };
}

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_level',
      description: 'Browse location hierarchy only: [] returns regions, [cityId] returns areas, [cityId, districtId] returns communities. [cityId, districtId, communityId] returns exactly one best-match property in that community. Use search_units for criteria; never request or present a multi-property list.',
      parameters: { type: 'object', properties: { path: { type: 'array', items: { type: 'string' }, description: 'IDs returned by the preceding list_level result; up to three IDs.' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_units',
      description: 'Exhaustively search every synthetic catalogue property and return at most one closest match. Use exact location names or IDs. Location, property type, minimum price, land, finishing, delivery, and excluded IDs remain hard constraints. Set relax=true only when a disclosed numeric relaxation is acceptable; strictBudget, strictArea, and strictBedrooms prevent those criteria from relaxing. Never widens geography. Result has one bestMatch only; payment plans are not returned.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' }, district: { type: 'string' }, compound: { type: 'string' },
          cityId: { type: 'string' }, districtId: { type: 'string' }, communityId: { type: 'string' },
          minBeds: { type: 'integer', minimum: 0 }, maxPrice: { type: 'number', description: 'Maximum EGP budget' },
          minPrice: { type: 'number', description: 'Minimum EGP budget' }, minBua: { type: 'number', description: 'Minimum interior area in square metres' },
          minLand: { type: 'number', description: 'Minimum land area in square metres' }, propertyType: { type: 'string', enum: ['apartment', 'townhouse', 'villa', 'chalet', 'penthouse'] },
          typeKeyword: { type: 'string' }, finishing: { type: 'string' }, deliveryBefore: { type: 'string', description: 'Latest acceptable delivery year, such as 2029' },
          excludeIds: { type: 'array', items: { type: 'string' } }, strictBudget: { type: 'boolean' }, strictArea: { type: 'boolean' }, strictBedrooms: { type: 'boolean' },
          relax: { type: 'boolean' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unit',
      description: 'Return details of one property by ID. Does not reveal payment plans; payment details are gated by the conversation flow.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function searchFiltersFrom(record: Record<string, unknown>): SearchFilters {
  const allowed = [
    'city', 'district', 'compound', 'cityId', 'districtId', 'communityId', 'minBeds', 'maxPrice', 'minPrice',
    'minBua', 'minLand', 'typeKeyword', 'propertyType', 'finishing', 'deliveryBefore', 'strictBudget', 'strictArea',
    'strictBedrooms', 'excludeIds',
  ] as const;
  return Object.fromEntries(allowed.filter((key) => record[key] !== undefined).map((key) => [key, record[key]])) as SearchFilters;
}

export function executeTool(name: string, args: unknown): ToolOutcome {
  try {
    const input = asRecord(args);
    switch (name) {
      case 'list_level':
        if (input.path !== undefined && (!Array.isArray(input.path) || !input.path.every((part) => typeof part === 'string'))) {
          return { status: 'Invalid hierarchy path', result: { error: 'path must be an array of string IDs' } };
        }
        return toolListLevel((input.path ?? []) as string[]);
      case 'search_units':
        if (input.relax !== undefined && typeof input.relax !== 'boolean') {
          return { status: 'Invalid search criteria', result: { validationErrors: ['relax must be boolean'] } };
        }
        return toolSearchUnits(searchFiltersFrom(input), input.relax === true);
      case 'get_unit':
        return toolGetUnit(typeof input.id === 'string' ? input.id : '');
      default:
        return { status: `Unknown tool ${name}`, result: { error: 'unknown tool' } };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected tool error';
    return { status: `Tool ${name} failed`, result: { error: message } };
  }
}
