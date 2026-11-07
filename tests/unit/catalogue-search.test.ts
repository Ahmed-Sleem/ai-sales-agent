import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import { searchCatalogue, searchClosestCatalogueMatch } from '../../lib/catalogueSearch';
import { executeTool, TOOL_DEFS, toolListLevel, toolSearchUnits } from '../../lib/agentTools';
import { AGENT_FINAL_INSTRUCTION, AGENT_SYSTEM_PROMPT } from '../../lib/agentPrompt';

describe('catalogue closest-match search', () => {
  it('returns the exact New Cairo match for budget, area, bedrooms, and type', () => {
    const result = searchCatalogue({
      district: 'New Cairo', maxBudgetEgp: 8_500_000, minAreaSqm: 160, minBedrooms: 3, typeKeyword: 'apartment',
    });
    expect(result.errors).toEqual([]);
    expect(result.matchedCount).toBe(1);
    expect(result.bestMatch?.id).toBe('demo-cairo-apartment-02');
    expect(result.relaxationsApplied).toEqual([]);
  });

  it('ranks by normalized fit score and returns the budget-nearest property', () => {
    const first = searchCatalogue({ city: 'Cairo', district: 'New Cairo', maxBudgetEgp: 11_300_000 });
    const second = searchCatalogue({ city: 'Cairo', district: 'New Cairo', maxBudgetEgp: 11_300_000 });
    expect(first.bestMatch?.id).toBe('demo-cairo-penthouse-01');
    expect(second.bestMatch?.id).toBe(first.bestMatch?.id);
    expect(second.score).toBe(first.score);
  });

  it('returns the nearest same-city candidate when no exact budget/area match exists', () => {
    const request = { cityId: 'giza-west', maxBudgetEgp: 5_000_000, minAreaSqm: 100 };
    expect(searchCatalogue(request).bestMatch).toBeNull();
    const closest = searchClosestCatalogueMatch(request);
    expect(closest.bestMatch).toMatchObject({ id: 'demo-october-apartment-01', priceEgp: 6_750_000, areaSqm: 148 });
    expect(closest.score).not.toBeNull();
  });

  it('respects location, qualitative filters, and exclusions while ranking closest candidates', () => {
    const closest = searchClosestCatalogueMatch({
      cityId: 'alexandria',
      maxBudgetEgp: 5_000_000,
      minAreaSqm: 100,
      excludeIds: ['demo-alexandria-apartment-01'],
    });
    expect(closest.bestMatch?.id).toBe('demo-alexandria-apartment-02');
    expect(closest.bestMatch?.city.id).toBe('alexandria');
  });

  it('does not treat West Cairo as a Cairo city match', () => {
    const result = searchCatalogue({ city: 'Cairo' });
    expect(result.bestMatch?.city.id).toBe('cairo');
    expect(result.matchedCount).toBe(INVENTORY.filter((property) => property.city.id === 'cairo').length);
  });

  it('uses the property ID as a stable tie-break when there are no preferences', () => {
    const first = searchCatalogue({ cityId: 'cairo' });
    const second = searchCatalogue({ cityId: 'cairo' });
    expect(first.bestMatch?.id).toBe('demo-cairo-apartment-01');
    expect(second.bestMatch?.id).toBe(first.bestMatch?.id);
  });

  it('honors excluded property IDs as hard constraints', () => {
    const result = searchCatalogue({ districtId: 'new-cairo', maxBudgetEgp: 8_500_000, excludeIds: ['demo-cairo-apartment-02'] });
    expect(result.bestMatch?.id).toBe('demo-cairo-apartment-01');
  });

  it('relaxes a soft budget by 15 percent from the original limit and discloses it', () => {
    const result = searchCatalogue({ districtId: 'new-cairo', maxBudgetEgp: 6_300_000, allowRelaxation: true });
    expect(result.bestMatch?.id).toBe('demo-cairo-apartment-01');
    expect(result.relaxationsApplied).toMatchObject([
      { criterion: 'budget', fromValue: 6_300_000, toValue: 7_245_000, percent: 15 },
    ]);
    expect(result.relaxationsApplied[0].label.en).toContain('15%');
    expect(result.relaxationsApplied[0].label.ar).toContain('١٥٪');
  });

  it('caps budget relaxation at 30 percent of the original amount, not compounded', () => {
    const result = searchCatalogue({ districtId: 'new-cairo', maxBudgetEgp: 6_000_000, allowRelaxation: true });
    expect(result.bestMatch?.id).toBe('demo-cairo-apartment-01');
    expect(result.relaxationsApplied.at(-1)).toMatchObject({
      criterion: 'budget', fromValue: 6_900_000, toValue: 7_800_000, percent: 30,
      label: { en: expect.stringContaining('above the original budget'), ar: expect.stringContaining('٣٠٪') },
    });
  });

  it('relaxes minimum area by 15 percent and records the original and adjusted floor', () => {
    const result = searchCatalogue({ districtId: 'new-cairo', minAreaSqm: 230, allowRelaxation: true });
    expect(result.bestMatch?.id).toBe('demo-cairo-penthouse-01');
    expect(result.relaxationsApplied).toContainEqual(expect.objectContaining({ criterion: 'area', fromValue: 230, toValue: 196 }));
  });

  it('reduces the minimum bedroom count by one when explicitly allowed', () => {
    const result = searchCatalogue({ districtId: '6th-october', typeKeyword: 'apartment', minBedrooms: 4, allowRelaxation: true });
    expect(result.bestMatch?.id).toBe('demo-october-apartment-01');
    expect(result.relaxationsApplied).toContainEqual(expect.objectContaining({ criterion: 'bedrooms', fromValue: 4, toValue: 3 }));
  });

  it('does not relax a strict budget', () => {
    const result = searchCatalogue({ districtId: 'new-cairo', maxBudgetEgp: 6_300_000, strictBudget: true, allowRelaxation: true });
    expect(result.bestMatch).toBeNull();
    expect(result.relaxationsAttempted.some((item) => item.criterion === 'budget')).toBe(false);
  });

  it('does not relax a strict area or strict bedroom threshold', () => {
    const areaResult = searchCatalogue({ districtId: 'new-cairo', minAreaSqm: 230, strictArea: true, allowRelaxation: true });
    const bedroomResult = searchCatalogue({ districtId: '6th-october', minBedrooms: 4, strictBedrooms: true, allowRelaxation: true });
    expect(areaResult.bestMatch).toBeNull();
    expect(areaResult.relaxationsAttempted.some((item) => item.criterion === 'area')).toBe(false);
    expect(bedroomResult.bestMatch).toBeNull();
    expect(bedroomResult.relaxationsAttempted.some((item) => item.criterion === 'bedrooms')).toBe(false);
  });

  it('never widens location or property type while relaxing numeric filters', () => {
    const noGeographicEscape = searchCatalogue({ district: 'New Cairo', maxBudgetEgp: 5_500_000, allowRelaxation: true });
    const partialDistrictEscape = searchCatalogue({ district: 'Cairo', maxBudgetEgp: 6_300_000, allowRelaxation: true });
    const noTypeEscape = searchCatalogue({ district: 'New Cairo', propertyType: 'villa', maxBudgetEgp: 6_300_000, allowRelaxation: true });
    expect(noGeographicEscape.bestMatch).toBeNull();
    expect(noGeographicEscape.relaxationsAttempted.length).toBeGreaterThan(0);
    expect(partialDistrictEscape.bestMatch).toBeNull();
    expect(noTypeEscape.bestMatch).toBeNull();
  });

  it('keeps community, minimum price, land, finishing, and delivery as hard filters', () => {
    const communityResult = searchCatalogue({ communityId: 'sample-east-02', maxBudgetEgp: 6_300_000, allowRelaxation: true });
    const minimumPriceResult = searchCatalogue({ districtId: 'new-cairo', minBudgetEgp: 11_300_000, maxBudgetEgp: 11_300_000, allowRelaxation: true });
    const landResult = searchCatalogue({ cityId: 'north-coast', propertyType: 'villa', minLandAreaSqm: 400, maxBudgetEgp: 18_000_000, allowRelaxation: true });
    const finishingResult = searchCatalogue({ districtId: 'new-cairo', propertyType: 'apartment', finishing: 'semi-finished', maxBudgetEgp: 6_300_000, allowRelaxation: true });
    const deliveryResult = searchCatalogue({ districtId: 'new-cairo', propertyType: 'penthouse', deliveryBeforeYear: 2028, maxBudgetEgp: 11_250_000, allowRelaxation: true });
    expect(communityResult.bestMatch).toBeNull();
    expect(minimumPriceResult.bestMatch).toBeNull();
    expect(landResult.bestMatch).toBeNull();
    expect(finishingResult.bestMatch).toBeNull();
    expect(deliveryResult.bestMatch).toBeNull();
  });

  it('returns no result without relaxation when hard constraints cannot be met', () => {
    const result = searchCatalogue({ district: 'New Cairo', maxBudgetEgp: 1_000_000 });
    expect(result.bestMatch).toBeNull();
    expect(result.relaxationsApplied).toEqual([]);
    expect(result.relaxationsAttempted).toEqual([]);
  });

  it('rejects invalid runtime constraints without coercing them', () => {
    const result = searchCatalogue({ maxBudgetEgp: Number.NaN, minBedrooms: 1.5 });
    expect(result.bestMatch).toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([
      'maxBudgetEgp must be a finite positive number',
      'minBedrooms must be a whole number from 0 to 20',
    ]));
  });

  it('returns only one search card and never exposes payment plans to the agent tool', () => {
    const outcome = toolSearchUnits({ cityId: 'cairo' });
    const result = outcome.result as { bestMatch: Record<string, unknown>; matchedCount: number; scannedTotal: number; relaxationsApplied: unknown[] };
    expect(result.scannedTotal).toBe(INVENTORY.length);
    expect(result.bestMatch).toBeTruthy();
    expect(result.bestMatch).not.toHaveProperty('paymentPlans');
    expect(result).not.toHaveProperty('results');
    expect(outcome.viz?.shortlistIds).toEqual([result.bestMatch.id]);
    expect(result.matchedCount).toBeGreaterThanOrEqual(1);
  });

  it('keeps payment-plan terms out of get_unit responses', () => {
    const result = executeTool('get_unit', { id: 'demo-cairo-apartment-01' }).result as Record<string, unknown>;
    expect(result).not.toHaveProperty('paymentPlans');
    expect(result).toMatchObject({ id: 'demo-cairo-apartment-01' });
  });

  it('rejects a malformed relax flag instead of silently treating it as false', () => {
    expect(executeTool('search_units', { relax: 'true' }).result).toMatchObject({ validationErrors: ['relax must be boolean'] });
  });

  it('rejects malformed hierarchy paths instead of silently browsing from the root', () => {
    expect(executeTool('list_level', { path: 'new-cairo' }).result).toMatchObject({ error: 'path must be an array of string IDs' });
  });

  it('keeps the live prompt and exposed tool set within the one-result contract', () => {
    const leaf = toolListLevel(['cairo', 'new-cairo', 'sample-east-01']).result as Record<string, unknown> & { stage: string; bestMatch: { id: string } };
    expect(leaf.stage).toBe('best-match');
    expect(leaf.bestMatch.id).toBeTruthy();
    expect(leaf).not.toHaveProperty('properties');
    expect(leaf).not.toHaveProperty('results');
    const exposedTools: readonly { function: { name: string } }[] = TOOL_DEFS;
    expect(exposedTools.some((tool) => tool.function.name === 'compare_units')).toBe(false);
    expect(executeTool('compare_units', { ids: ['a', 'b'] }).result).toMatchObject({ error: 'unknown tool' });
    expect(AGENT_SYSTEM_PROMPT).toContain('present exactly that one property');
    expect(AGENT_SYSTEM_PROMPT).not.toContain('compare_units');
    expect(AGENT_FINAL_INSTRUCTION).toContain('exactly one closest property');
  });
});
