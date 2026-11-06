import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import {
  answerQualification,
  beginQualification,
  PDF_ARABIC_GREETING,
  type QualificationPrompt,
} from '../../lib/qualification';

function questionCount(prompt: QualificationPrompt): number {
  return (prompt.text.match(/[?؟]/g) ?? []).length;
}

describe('qualification state machine', () => {
  it('starts with the exact PDF Arabic greeting and waits for the visitor reply', () => {
    const step = beginQualification('ar');
    expect(step.prompt).toMatchObject({ question: 'greeting', text: PDF_ARABIC_GREETING, quickReplies: [] });
    expect(step.state.answers).toEqual({});
    expect(questionCount(step.prompt)).toBe(1);
  });

  it('provides a one-question English greeting that identifies Sara as the sales manager', () => {
    const step = beginQualification('en');
    expect(step.prompt.text).toContain("I'm Sara, the sales manager.");
    expect(questionCount(step.prompt)).toBe(1);
  });

  it('asks for location first and derives bilingual location choices from the catalogue', () => {
    const { state } = beginQualification('en');
    const step = answerQualification(state, {});
    const expectedCities = new Set(INVENTORY.map((property) => property.city.id));
    expect(step.prompt.question).toBe('location');
    expect(step.prompt.quickReplies.map((reply) => reply.answer.location?.cityId)).toEqual([...expectedCities].sort());
    expect(step.prompt.quickReplies.every((reply) => Boolean(reply.label))).toBe(true);
    expect(questionCount(step.prompt)).toBe(1);

    const arabicStep = answerQualification(beginQualification('ar').state, {});
    expect(arabicStep.prompt.text).toContain('مدينة أو منطقة');
    expect(arabicStep.prompt.quickReplies).toHaveLength(expectedCities.size);
  });

  it('asks budget after location, uses the canonical localized city name, and never repeats location', () => {
    const start = beginQualification('en');
    const step = answerQualification(start.state, { location: { cityId: 'cairo' } });
    expect(step.state.answers.location).toMatchObject({ cityId: 'cairo', cityName: { en: 'Cairo', ar: 'القاهرة' } });
    expect(step.prompt.question).toBe('budget');
    expect(step.prompt.text).toContain('maximum budget');
    expect(questionCount(step.prompt)).toBe(1);
    expect(step.prompt.quickReplies.map((reply) => reply.answer.budgetMaxEgp)).toEqual([5_000_000, 8_000_000, 12_000_000]);
    expect(questionCount(step.prompt)).toBe(1);
  });

  it('preserves volunteered later answers while asking missing fields in location-budget-area order', () => {
    const start = beginQualification('en');
    const withBudget = answerQualification(start.state, { budgetMaxEgp: 8_000_000 });
    expect(withBudget.prompt.question).toBe('location');
    const withLocation = answerQualification(withBudget.state, { location: { cityId: 'alexandria' } });
    expect(withLocation.state.answers.budgetMaxEgp).toBe(8_000_000);
    expect(withLocation.prompt.question).toBe('area');
    expect(questionCount(withLocation.prompt)).toBe(1);
    expect(withLocation.prompt.quickReplies.map((reply) => reply.answer.minAreaSqm)).toEqual([100, 150, 200]);
    expect(questionCount(withLocation.prompt)).toBe(1);
  });

  it('accepts all supplied fields, skips answered questions, and becomes ready without another question', () => {
    const start = beginQualification('en');
    const step = answerQualification(start.state, {
      location: { cityId: 'giza-west' },
      budgetMaxEgp: 15_000_000,
      minAreaSqm: 180,
    });
    expect(step.state.answers).toMatchObject({
      location: { cityId: 'giza-west' },
      budgetMaxEgp: 15_000_000,
      minAreaSqm: 180,
    });
    expect(step.prompt.question).toBeNull();
    expect(step.prompt.quickReplies).toEqual([]);
    expect(questionCount(step.prompt)).toBe(0);
  });

  it('clarifies an unknown or empty location without accepting or corrupting it', () => {
    for (const cityId of ['not-a-catalogue-city', '   ']) {
      const step = answerQualification(beginQualification('en').state, { location: { cityId } });
      expect(step.state.answers.location).toBeUndefined();
      expect(step.prompt).toMatchObject({ question: 'location', clarification: true });
      expect(step.prompt.text).toContain("couldn't match that location");
      expect(questionCount(step.prompt)).toBe(1);
    }
  });

  it('rejects a district/community outside the selected city hierarchy', () => {
    const step = answerQualification(beginQualification('en').state, {
      location: { cityId: 'cairo', districtId: 'sheikh-zayed' },
    });
    expect(step.state.answers.location).toBeUndefined();
    expect(step.prompt).toMatchObject({ question: 'location', clarification: true });
  });

  it('clarifies non-positive, non-finite, and out-of-range budgets without storing them', () => {
    const location = { cityId: 'cairo' };
    for (const budgetMaxEgp of [0, -1, Number.POSITIVE_INFINITY, Number.NaN, 1_000_000_000_001]) {
      const step = answerQualification(beginQualification('en').state, { location, budgetMaxEgp });
      expect(step.state.answers.budgetMaxEgp).toBeUndefined();
      expect(step.prompt).toMatchObject({ question: 'budget', clarification: true });
      expect(questionCount(step.prompt)).toBe(1);
    }
  });

  it('clarifies invalid areas and preserves previously valid answers', () => {
    const start = beginQualification('en');
    const valid = answerQualification(start.state, { location: { cityId: 'cairo' }, budgetMaxEgp: 8_000_000 });
    for (const minAreaSqm of [0, -2, Number.POSITIVE_INFINITY, Number.NaN, 1_000_001]) {
      const step = answerQualification(valid.state, { minAreaSqm });
      expect(step.state.answers).toMatchObject({
        location: { cityId: 'cairo' },
        budgetMaxEgp: 8_000_000,
      });
      expect(step.state.answers.minAreaSqm).toBeUndefined();
      expect(step.prompt).toMatchObject({ question: 'area', clarification: true });
      expect(questionCount(step.prompt)).toBe(1);
    }
  });

  it('accepts valid quick-reply payloads and never produces more than one question per turn', () => {
    let step = beginQualification('ar');
    step = answerQualification(step.state, {});
    const locationChoice = step.prompt.quickReplies.find((reply) => reply.id === 'location-cairo');
    expect(locationChoice).toBeDefined();
    step = answerQualification(step.state, locationChoice!.answer);
    expect(step.prompt.question).toBe('budget');
    expect(step.prompt.quickReplies.map((reply) => reply.label)).toEqual(['٥ ملايين جنيه', '٨ ملايين جنيه', '١٢ مليون جنيه']);
    const budgetChoice = step.prompt.quickReplies[0];
    step = answerQualification(step.state, budgetChoice.answer);
    expect(step.prompt.question).toBe('area');
    expect(step.prompt.quickReplies.map((reply) => reply.label)).toEqual(['حوالي ١٠٠ م²', 'حوالي ١٥٠ م²', 'حوالي ٢٠٠ م²']);
    const areaChoice = step.prompt.quickReplies[0];
    step = answerQualification(step.state, areaChoice.answer);
    expect(step.prompt.question).toBeNull();
    expect(step.state.answers).toMatchObject({
      location: { cityId: 'cairo' },
      budgetMaxEgp: 5_000_000,
      minAreaSqm: 100,
    });
    expect(questionCount(step.prompt)).toBe(0);
  });
});
