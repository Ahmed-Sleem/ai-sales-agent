import { INVENTORY, type InventoryProperty, type LocalizedText, type PropertyType } from '../data/catalogue';

export interface SearchRequest {
  readonly cityId?: string;
  readonly districtId?: string;
  readonly communityId?: string;
  readonly city?: string;
  readonly district?: string;
  readonly community?: string;
  readonly maxBudgetEgp?: number;
  readonly minBudgetEgp?: number;
  readonly minAreaSqm?: number;
  readonly minBedrooms?: number;
  readonly minLandAreaSqm?: number;
  readonly propertyType?: PropertyType;
  readonly typeKeyword?: string;
  readonly finishing?: string;
  readonly deliveryBeforeYear?: number;
  readonly excludeIds?: readonly string[];
  readonly strictBudget?: boolean;
  readonly strictArea?: boolean;
  readonly strictBedrooms?: boolean;
  readonly allowRelaxation?: boolean;
}

export type RelaxableCriterion = 'budget' | 'area' | 'bedrooms';
export interface AppliedRelaxation {
  readonly criterion: RelaxableCriterion;
  readonly fromValue: number;
  readonly toValue: number;
  readonly percent?: 15 | 30;
  readonly label: LocalizedText;
}
export interface CatalogueSearchResult {
  readonly bestMatch: InventoryProperty | null;
  readonly score: number | null;
  readonly matchedCount: number;
  readonly scannedCount: number;
  readonly relaxationsApplied: readonly AppliedRelaxation[];
  readonly relaxationsAttempted: readonly AppliedRelaxation[];
  readonly errors: readonly string[];
}

const PROPERTY_TYPE_TERMS: Record<PropertyType, readonly string[]> = {
  apartment: ['apartment', 'flat', 'شقة', 'شقق'],
  townhouse: ['townhouse', 'town house', 'تاون هاوس', 'تاونهاوس'],
  villa: ['villa', 'فيلا', 'فيلات'],
  chalet: ['chalet', 'شاليه', 'شاليهات'],
  penthouse: ['penthouse', 'بنتهاوس', 'بنت هاوس'],
};
const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_TERMS) as PropertyType[];
const ARABIC_DIACRITICS_AND_TATWEEL = /[\u064B-\u065F\u0670\u0640]/g;

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(ARABIC_DIACRITICS_AND_TATWEEL, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
}
function containsText(haystack: string, query?: string): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeText(query);
  return normalizeText(haystack).includes(normalizedQuery);
}
function matchesLocalizedText(value: LocalizedText, query?: string, exact = false): boolean {
  if (!query) return true;
  if (exact) {
    const normalizedQuery = normalizeText(query);
    return normalizeText(value.en) === normalizedQuery || normalizeText(value.ar) === normalizedQuery;
  }
  return containsText(value.en, query) || containsText(value.ar, query);
}
function matchesLocation<T extends { id: string; name: LocalizedText }>(
  value: T,
  id: string | undefined,
  name: string | undefined,
): boolean {
  return (!id || value.id === id) && matchesLocalizedText(value.name, name, true);
}

function requestErrors(request: SearchRequest): string[] {
  const errors: string[] = [];
  const positiveNumbers: Array<[keyof SearchRequest, number | undefined]> = [
    ['maxBudgetEgp', request.maxBudgetEgp],
    ['minAreaSqm', request.minAreaSqm],
    ['minLandAreaSqm', request.minLandAreaSqm],
  ];
  for (const [key, value] of positiveNumbers) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) errors.push(`${key} must be a finite positive number`);
  }
  if (request.minBudgetEgp !== undefined && (!Number.isFinite(request.minBudgetEgp) || request.minBudgetEgp < 0)) {
    errors.push('minBudgetEgp must be a finite non-negative number');
  }
  if (request.maxBudgetEgp !== undefined && request.minBudgetEgp !== undefined && request.minBudgetEgp > request.maxBudgetEgp) {
    errors.push('minBudgetEgp must not exceed maxBudgetEgp');
  }
  if (request.minBedrooms !== undefined && (!Number.isInteger(request.minBedrooms) || request.minBedrooms < 0 || request.minBedrooms > 20)) {
    errors.push('minBedrooms must be a whole number from 0 to 20');
  }
  if (request.deliveryBeforeYear !== undefined && (!Number.isInteger(request.deliveryBeforeYear) || request.deliveryBeforeYear < 2000 || request.deliveryBeforeYear > 2100)) {
    errors.push('deliveryBeforeYear must be a whole year from 2000 to 2100');
  }
  if (request.propertyType !== undefined && !PROPERTY_TYPES.includes(request.propertyType)) errors.push('propertyType is not supported');
  for (const [key, value] of Object.entries(request)) {
    if (['city', 'district', 'community', 'cityId', 'districtId', 'communityId', 'typeKeyword', 'finishing'].includes(key) && value !== undefined && (typeof value !== 'string' || value.length > 120)) {
      errors.push(`${key} must be text no longer than 120 characters`);
    }
  }
  if (request.excludeIds !== undefined && (!Array.isArray(request.excludeIds) || request.excludeIds.some((id) => typeof id !== 'string' || id.length > 120))) {
    errors.push('excludeIds must contain only IDs no longer than 120 characters');
  }
  for (const key of ['strictBudget', 'strictArea', 'strictBedrooms', 'allowRelaxation'] as const) {
    if (request[key] !== undefined && typeof request[key] !== 'boolean') errors.push(`${key} must be boolean`);
  }
  return errors;
}

function matchesRequest(property: InventoryProperty, request: SearchRequest, overrides: {
  maxBudgetEgp?: number;
  minAreaSqm?: number;
  minBedrooms?: number;
} = {}): boolean {
  const maxBudget = overrides.maxBudgetEgp ?? request.maxBudgetEgp;
  const minArea = overrides.minAreaSqm ?? request.minAreaSqm;
  const minBedrooms = overrides.minBedrooms ?? request.minBedrooms;
  if (!matchesLocation(property.city, request.cityId, request.city)) return false;
  if (!matchesLocation(property.district, request.districtId, request.district)) return false;
  if (!matchesLocation(property.community, request.communityId, request.community)) return false;
  if (request.propertyType && property.propertyType !== request.propertyType) return false;
  if (request.typeKeyword && !(
    matchesLocalizedText(property.title, request.typeKeyword) ||
    PROPERTY_TYPE_TERMS[property.propertyType].some((term) => containsText(term, request.typeKeyword))
  )) return false;
  if (request.finishing && !matchesLocalizedText(property.finishing, request.finishing)) return false;
  if (request.deliveryBeforeYear !== undefined && property.deliveryYear > request.deliveryBeforeYear) return false;
  if (request.minBudgetEgp !== undefined && property.priceEgp < request.minBudgetEgp) return false;
  if (maxBudget !== undefined && property.priceEgp > maxBudget) return false;
  if (minArea !== undefined && property.areaSqm < minArea) return false;
  if (minBedrooms !== undefined && property.bedrooms < minBedrooms) return false;
  if (request.minLandAreaSqm !== undefined && (property.landAreaSqm ?? 0) < request.minLandAreaSqm) return false;
  if (request.excludeIds?.includes(property.id)) return false;
  return true;
}

function fitScore(property: InventoryProperty, request: SearchRequest): number {
  let score = 0;
  if (request.maxBudgetEgp !== undefined) {
    const target = request.minBudgetEgp === undefined ? request.maxBudgetEgp : (request.maxBudgetEgp + request.minBudgetEgp) / 2;
    score += Math.abs(property.priceEgp - target) / Math.max(1, target) * 0.45;
  } else if (request.minBudgetEgp !== undefined) {
    score += Math.abs(property.priceEgp - request.minBudgetEgp) / Math.max(1, request.minBudgetEgp) * 0.45;
  }
  if (request.minAreaSqm !== undefined) score += Math.abs(property.areaSqm - request.minAreaSqm) / Math.max(1, request.minAreaSqm) * 0.35;
  if (request.minBedrooms !== undefined) score += Math.abs(property.bedrooms - request.minBedrooms) / Math.max(1, request.minBedrooms) * 0.20;
  return score;
}

function compareMatches(a: InventoryProperty, b: InventoryProperty, request: SearchRequest): number {
  const scoreDifference = fitScore(a, request) - fitScore(b, request);
  if (Math.abs(scoreDifference) > Number.EPSILON) return scoreDifference;
  return a.id.localeCompare(b.id, 'en');
}

function relaxation(
  criterion: RelaxableCriterion,
  fromValue: number,
  toValue: number,
  percent?: 15 | 30,
): AppliedRelaxation {
  const label: LocalizedText = criterion === 'budget'
    ? percent === 30
      ? {
          en: 'Maximum budget cap extended to 30% above the original budget',
          ar: 'تم رفع الحد الأقصى للميزانية إلى ٣٠٪ فوق الميزانية الأصلية',
        }
      : {
          en: 'Maximum budget increased by 15% from the original budget',
          ar: 'تمت زيادة الحد الأقصى للميزانية بنسبة ١٥٪ من الميزانية الأصلية',
        }
    : criterion === 'area'
      ? { en: 'Minimum area reduced by 15%', ar: 'تم تقليل الحد الأدنى للمساحة بنسبة ١٥٪' }
      : { en: 'Minimum bedroom count reduced by one', ar: 'تم تقليل الحد الأدنى لعدد غرف النوم بمقدار غرفة واحدة' };
  return { criterion, fromValue, toValue, ...(percent === undefined ? {} : { percent }), label };
}

export function searchCatalogue(request: SearchRequest): CatalogueSearchResult {
  const errors = requestErrors(request);
  if (errors.length) return { bestMatch: null, score: null, matchedCount: 0, scannedCount: INVENTORY.length, relaxationsApplied: [], relaxationsAttempted: [], errors };

  const exact = INVENTORY.filter((property) => matchesRequest(property, request));
  if (exact.length) {
    const bestMatch = [...exact].sort((a, b) => compareMatches(a, b, request))[0];
    return { bestMatch, score: fitScore(bestMatch, request), matchedCount: exact.length, scannedCount: INVENTORY.length, relaxationsApplied: [], relaxationsAttempted: [], errors: [] };
  }

  if (!request.allowRelaxation) {
    return { bestMatch: null, score: null, matchedCount: 0, scannedCount: INVENTORY.length, relaxationsApplied: [], relaxationsAttempted: [], errors: [] };
  }

  const overrides: { maxBudgetEgp?: number; minAreaSqm?: number; minBedrooms?: number } = {};
  const attempted: AppliedRelaxation[] = [];
  const steps: Array<{ record: AppliedRelaxation; apply: () => void }> = [];
  if (request.maxBudgetEgp !== undefined && !request.strictBudget) {
    const firstLimit = Math.round(request.maxBudgetEgp * 1.15);
    steps.push({
      record: relaxation('budget', request.maxBudgetEgp, firstLimit, 15),
      apply: () => { overrides.maxBudgetEgp = firstLimit; },
    });
  }
  if (request.minAreaSqm !== undefined && !request.strictArea) {
    const relaxedArea = Math.round(request.minAreaSqm * 0.85);
    steps.push({
      record: relaxation('area', request.minAreaSqm, relaxedArea, 15),
      apply: () => { overrides.minAreaSqm = relaxedArea; },
    });
  }
  if (request.minBedrooms !== undefined && request.minBedrooms > 1 && !request.strictBedrooms) {
    const relaxedBedrooms = request.minBedrooms - 1;
    steps.push({
      record: relaxation('bedrooms', request.minBedrooms, relaxedBedrooms),
      apply: () => { overrides.minBedrooms = relaxedBedrooms; },
    });
  }
  if (request.maxBudgetEgp !== undefined && !request.strictBudget) {
    const currentLimit = Math.round(request.maxBudgetEgp * 1.15);
    const finalLimit = Math.round(request.maxBudgetEgp * 1.30);
    steps.push({
      record: relaxation('budget', currentLimit, finalLimit, 30),
      apply: () => { overrides.maxBudgetEgp = finalLimit; },
    });
  }

  for (const step of steps) {
    step.apply();
    attempted.push(step.record);
    const matches = INVENTORY.filter((property) => matchesRequest(property, request, overrides));
    if (matches.length) {
      const bestMatch = [...matches].sort((a, b) => compareMatches(a, b, request))[0];
      return {
        bestMatch,
        score: fitScore(bestMatch, request),
        matchedCount: matches.length,
        scannedCount: INVENTORY.length,
        relaxationsApplied: [...attempted],
        relaxationsAttempted: [...attempted],
        errors: [],
      };
    }
  }

  return { bestMatch: null, score: null, matchedCount: 0, scannedCount: INVENTORY.length, relaxationsApplied: [], relaxationsAttempted: attempted, errors: [] };
}
