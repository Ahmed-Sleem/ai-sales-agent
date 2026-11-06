import { describe, expect, it } from 'vitest';
import { beginPropertyDisclosure, advancePropertyDisclosure } from '../../lib/propertyDisclosure';
import { answerPropertyFollowUp, beginPropertyFollowUp } from '../../lib/propertyFollowUp';
import { answerQualification, beginQualification, type QualificationState } from '../../lib/qualification';
import { parseDemoInput, type DemoNluContext, type DemoNluResult } from '../../lib/demoNlu';

const SELECTED = 'demo-cairo-apartment-01';
const SEARCH = { cityId: 'cairo', maxBudgetEgp: 8_500_000, minAreaSqm: 100 } as const;

function qaState(language: 'ar' | 'en' = 'en'): QualificationState {
  return beginQualification(language).state;
}
function result(text: string, context: DemoNluContext, quickReplyId?: string): DemoNluResult {
  return parseDemoInput({ text, ...(quickReplyId ? { quickReplyId } : {}) }, context);
}
function questionCount(text: string): number {
  return (text.match(/[?؟]/g) ?? []).length;
}

describe('deterministic offline demo input adapter', () => {
  it('maps English and Arabic locations, including district-only answers, to catalogue IDs', () => {
    expect(result('New Cairo, please', { kind: 'qualification', state: qaState() })).toEqual({
      kind: 'qualification', input: { location: { cityId: 'cairo', districtId: 'new-cairo' } },
    });
    expect(result('القاهرة الجديدة', { kind: 'qualification', state: qaState('ar') })).toEqual({
      kind: 'qualification', input: { location: { cityId: 'cairo', districtId: 'new-cairo' } },
    });
    expect(result('Giza', { kind: 'qualification', state: qaState() })).toEqual({
      kind: 'qualification', input: { location: { cityId: 'giza-west' } },
    });
    expect(result('الإسكندرية', { kind: 'qualification', state: qaState('ar') })).toEqual({
      kind: 'qualification', input: { location: { cityId: 'alexandria' } },
    });
  });

  it('asks one clarification for unknown or conflicting locations', () => {
    const askingLocation = answerQualification(qaState(), {}).state;
    const unknown = result('somewhere far away', { kind: 'qualification', state: askingLocation });
    expect(unknown.kind).toBe('clarification');
    if (unknown.kind === 'clarification') {
      expect(unknown.text).toContain("couldn't match that location");
      expect(questionCount(unknown.text)).toBe(1);
    }
    const conflict = result('New Cairo and Maadi', { kind: 'qualification', state: qaState() });
    expect(conflict.kind).toBe('clarification');
    if (conflict.kind === 'clarification') expect(questionCount(conflict.text)).toBe(1);
  });

  it.each([
    ['8.5 million EGP', 8_500_000],
    ['EGP 8,500,000', 8_500_000],
    ['8k EGP', 8_000],
    ['٨ ملايين جنيه', 8_000_000],
    ['٥ مليون جنيه', 5_000_000],
  ])('parses budget phrase %s as EGP %s', (text, budgetMaxEgp) => {
    const state = answerQualification(qaState(), { location: { cityId: 'cairo' } }).state;
    expect(result(text, { kind: 'qualification', state })).toEqual({ kind: 'qualification', input: { budgetMaxEgp } });
  });

  it('does not guess a bare small budget or a range with two numbers', () => {
    const state = answerQualification(qaState(), { location: { cityId: 'cairo' } }).state;
    for (const text of ['8', 'between 5 and 8 million']) {
      const parsed = result(text, { kind: 'qualification', state });
      expect(parsed.kind).toBe('clarification');
      if (parsed.kind === 'clarification') expect(questionCount(parsed.text)).toBe(1);
    }
  });

  it('parses metric area with Arabic digits and rejects unsupported square feet', () => {
    const state = answerQualification(qaState(), {
      location: { cityId: 'cairo' }, budgetMaxEgp: 8_000_000,
    }).state;
    expect(result('about 160 square metres', { kind: 'qualification', state })).toEqual({
      kind: 'qualification', input: { minAreaSqm: 160 },
    });
    expect(result('١٥٠ متر مربع', { kind: 'qualification', state })).toEqual({
      kind: 'qualification', input: { minAreaSqm: 150 },
    });
    expect(result('1,500 square feet', { kind: 'qualification', state }).kind).toBe('clarification');
  });

  it('accepts localized catalogue quick-reply IDs and labels in the active qualification phase', () => {
    const start = answerQualification(qaState('ar'), {});
    expect(result('القاهرة', { kind: 'qualification', state: start.state }, 'location-cairo')).toEqual({
      kind: 'qualification', input: { location: { cityId: 'cairo' } },
    });
    const budgetState = answerQualification(start.state, { location: { cityId: 'cairo' } }).state;
    expect(result('٥ ملايين جنيه', { kind: 'qualification', state: budgetState })).toEqual({
      kind: 'qualification', input: { budgetMaxEgp: 5_000_000 },
    });
    expect(result('not relevant', { kind: 'qualification', state: budgetState }, 'not-a-real-reply').kind).toBe('clarification');
  });

  it('maps yes to exactly one staged disclosure continuation, but never skips to payment early', () => {
    const location = beginPropertyDisclosure(SELECTED, 'en').state;
    expect(result('yes, please', { kind: 'disclosure', state: location })).toEqual({
      kind: 'disclosure', action: { type: 'continue' },
    });
    expect(result('أيوه', { kind: 'disclosure', state: { ...location, language: 'ar' } })).toEqual({
      kind: 'disclosure', action: { type: 'continue' },
    });
    const price = advancePropertyDisclosure(location, { type: 'continue' }).state;
    expect(result('sure', { kind: 'disclosure', state: price })).toEqual({
      kind: 'disclosure', action: { type: 'continue' },
    });
    const outOfOrder = result('installments', { kind: 'disclosure', state: location });
    expect(outOfOrder.kind).toBe('clarification');
    if (outOfOrder.kind === 'clarification') {
      expect(outOfOrder.text).toMatch(/Would you like to hear the price/i);
      expect(questionCount(outOfOrder.text)).toBe(1);
    }
  });

  it('parses Arabic and English cash/installments choices and clarifies combined choices', () => {
    const area = { kind: 'disclosure' as const, state: { ...beginPropertyDisclosure(SELECTED, 'en').state, phase: 'area' as const } };
    expect(result('cash please', area)).toEqual({
      kind: 'disclosure', action: { type: 'payment-preference', preference: 'cash' },
    });
    expect(result('خطة تقسيط', { ...area, state: { ...area.state, language: 'ar' as const } })).toEqual({
      kind: 'disclosure', action: { type: 'payment-preference', preference: 'installments' },
    });
    expect(result('cash or installments', area).kind).toBe('clarification');
  });

  it('maps explicit confirm, explore, and photo intent while clarifying ambiguous yes', () => {
    const follow = { kind: 'follow-up' as const, state: beginPropertyFollowUp(SELECTED, SEARCH, 'en').state };
    expect(result('Confirm interest', follow)).toEqual({ kind: 'follow-up', action: { type: 'confirm' } });
    expect(result('استكشف اختيار تاني', { ...follow, state: { ...follow.state, language: 'ar' } })).toEqual({
      kind: 'follow-up', action: { type: 'explore' },
    });
    expect(result('send demo photos', follow)).toEqual({ kind: 'follow-up', action: { type: 'send-photos' } });
    const ambiguous = result('yes', follow);
    expect(ambiguous.kind).toBe('clarification');
    expect(result('confirm interest or explore another', follow).kind).toBe('clarification');
    if (ambiguous.kind === 'clarification') {
      expect(ambiguous.text).toMatch(/confirm interest.*explore another/i);
      expect(questionCount(ambiguous.text)).toBe(1);
    }
    const arabicAmbiguous = result('تمام', { ...follow, state: { ...follow.state, language: 'ar' } });
    expect(arabicAmbiguous.kind).toBe('clarification');
    if (arabicAmbiguous.kind === 'clarification') {
      expect(arabicAmbiguous.text).toContain('تأكد اهتمامك');
      expect(questionCount(arabicAmbiguous.text)).toBe(1);
    }
  });

  it('captures bilingual rejection reasons and bounded visitor detail; unclassified prose maps to other', () => {
    const decision = beginPropertyFollowUp(SELECTED, SEARCH, 'en').state;
    const reason = answerPropertyFollowUp(decision, { type: 'explore' }).state;
    expect(result('The price is too high for me', { kind: 'follow-up', state: reason })).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'price', detail: 'The price is too high for me' },
    });
    expect(result('الموقع بعيد عن شغلي', { kind: 'follow-up', state: { ...reason, language: 'ar' } })).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'location', detail: 'الموقع بعيد عن شغلي' },
    });
    expect(result('Too dark inside', { kind: 'follow-up', state: reason })).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'other', detail: 'Too dark inside' },
    });
    expect(result('The area is too small', { kind: 'follow-up', state: reason })).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'area', detail: 'The area is too small' },
    });
    expect(result('السداد مكلف', { kind: 'follow-up', state: { ...reason, language: 'ar' } })).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'payment-plan', detail: 'السداد مكلف' },
    });
    expect(result('price and installments', { kind: 'follow-up', state: reason }).kind).toBe('clarification');
    expect(result('x'.repeat(241), { kind: 'follow-up', state: reason }).kind).toBe('clarification');
    expect(result('reason-price', { kind: 'follow-up', state: reason }, 'reason-price')).toEqual({
      kind: 'follow-up', action: { type: 'reject', reason: 'price' },
    });
  });

  it('never calls external AI and rejects out-of-order or unknown quick replies with one prompt', () => {
    const follow = { kind: 'follow-up' as const, state: beginPropertyFollowUp(SELECTED, SEARCH, 'en').state };
    const invalid = result('cash', follow, 'payment-cash');
    expect(invalid.kind).toBe('clarification');
    expect(result('Confirm interest', follow, 'payment-cash').kind).toBe('clarification');
    if (invalid.kind === 'clarification') expect(questionCount(invalid.text)).toBe(1);
    expect(parseDemoInput({ text: '' }, follow).kind).toBe('clarification');
    expect(parseDemoInput({ text: `New Cairo ${'x'.repeat(500)}` }, { kind: 'qualification', state: qaState() }).kind).toBe('clarification');

  });
});
