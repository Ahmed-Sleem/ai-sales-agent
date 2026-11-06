import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import {
  answerPropertyFollowUp,
  beginPropertyFollowUp,
  type PropertyFollowUpAction,
} from '../../lib/propertyFollowUp';
import type { SearchRequest } from '../../lib/catalogueSearch';

const SELECTED = 'demo-cairo-apartment-01';
const SEARCH: SearchRequest = { cityId: 'cairo', maxBudgetEgp: 8_500_000, minAreaSqm: 100 };

function questionCount(text: string): number {
  return (text.match(/[?؟]/g) ?? []).length;
}

describe('property confirmation, rejection, alternatives, and photos', () => {
  it('offers confirm/explore choices and a photo action in one bilingual decision question', () => {
    const step = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    expect(step.state).toMatchObject({ currentPropertyId: SELECTED, phase: 'decision', shownPropertyIds: [SELECTED] });
    expect(step.prompt.kind).toBe('decision');
    expect(step.prompt.text).toMatch(/confirm.*or explore/i);
    expect(step.prompt.quickReplies.map((reply) => reply.id)).toEqual(['confirm', 'explore', 'photos']);
    expect(questionCount(step.prompt.text)).toBe(1);

    const arabic = beginPropertyFollowUp(SELECTED, SEARCH, 'ar');
    expect(arabic.prompt.text).toContain('تأكد اهتمامك');
    expect(arabic.prompt.quickReplies.map((reply) => reply.label)).toContain('استكشاف اختيار آخر');
    expect(questionCount(arabic.prompt.text)).toBe(1);
  });

  it('records confirmation for exactly the current property', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    const step = answerPropertyFollowUp(start.state, { type: 'confirm' });
    expect(step.state).toMatchObject({ phase: 'confirmed', currentPropertyId: SELECTED });
    expect(step.prompt.kind).toBe('confirmed');
    expect(step.prompt.text).toContain('Apartment 01');
    expect(step.prompt.nextPropertyId).toBeUndefined();
    expect(step.prompt.photos).toBeUndefined();
  });

  it('asks for the reason after explore and supplies the supported reason categories', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    const step = answerPropertyFollowUp(start.state, { type: 'explore' });
    expect(step.state.phase).toBe('rejection-reason');
    expect(step.prompt.kind).toBe('rejection-reason');
    expect(step.prompt.quickReplies.map((reply) => (reply.action as Extract<PropertyFollowUpAction, { type: 'reject' }>).reason))
      .toEqual(['price', 'location', 'area', 'payment-plan', 'other']);
    expect(questionCount(step.prompt.text)).toBe(1);
  });

  it.each(['price', 'location', 'area', 'payment-plan', 'other'] as const)(
    'records the %s rejection reason against the current property',
    (reason) => {
      const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
      const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
      const step = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason });
      expect(step.state.rejections[0]).toEqual({ propertyId: SELECTED, reason });
      expect(step.state.phase === 'alternative-ready' || step.state.phase === 'no-alternative').toBe(true);
    },
  );

  it('records a rejection reason and returns at most one unseen alternative', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en', ['demo-cairo-apartment-02']);
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const alternative = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'price' });
    const nextId = alternative.prompt.nextPropertyId;
    expect(alternative.state.phase).toBe('alternative-ready');
    expect(alternative.state.rejections).toEqual([{ propertyId: SELECTED, reason: 'price' }]);
    expect(nextId).toBeDefined();
    expect(nextId).not.toBe(SELECTED);
    expect(nextId).not.toBe('demo-cairo-apartment-02');
    expect(alternative.state.shownPropertyIds).toContain(nextId);
    expect(alternative.prompt.text).toContain('price');
    expect(alternative.prompt.photos).toBeUndefined();
    expect(alternative.prompt.quickReplies).toEqual([]);
  });

  it('never returns the rejected property even when it is the only match', () => {
    const request: SearchRequest = { cityId: 'cairo', districtId: 'new-cairo', propertyType: 'apartment', maxBudgetEgp: 7_200_000, minAreaSqm: 120 };
    const start = beginPropertyFollowUp(SELECTED, request, 'en');
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const step = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'price' });
    expect(step.state.phase).toBe('no-alternative');
    expect(step.prompt.nextPropertyId).toBeUndefined();
  });

  it('excludes properties shown in earlier turns, not just the current rejection', () => {
    const request: SearchRequest = {
      cityId: 'cairo',
      districtId: 'new-cairo',
      propertyType: 'apartment',
      maxBudgetEgp: 8_500_000,
      minAreaSqm: 160,
    };
    const start = beginPropertyFollowUp(SELECTED, request, 'en', ['demo-cairo-apartment-02']);
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const step = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'area' });
    expect(step.state.phase).toBe('no-alternative');
    expect(step.prompt.nextPropertyId).toBeUndefined();
  });

  it('stores a bounded, trimmed visitor detail with its reason', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const step = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'area', detail: '  Needs a larger living room.  ' });
    expect(step.state.rejections[0]).toEqual({ propertyId: SELECTED, reason: 'area', detail: 'Needs a larger living room.' });
    expect(step.state.phase).toBe('alternative-ready');
  });

  it('does not mutate state or search when a rejection detail is too long', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const invalid = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'other', detail: 'x'.repeat(241) });
    expect(invalid.state).toEqual(askingReason.state);
    expect(invalid.prompt.kind).toBe('rejection-reason');
    expect(invalid.prompt.nextPropertyId).toBeUndefined();
  });

  it('reports no alternative instead of fabricating a result', () => {
    const request: SearchRequest = { cityId: 'cairo', propertyType: 'penthouse', maxBudgetEgp: 10_000_000 };
    const start = beginPropertyFollowUp(SELECTED, request, 'en');
    const askingReason = answerPropertyFollowUp(start.state, { type: 'explore' });
    const step = answerPropertyFollowUp(askingReason.state, { type: 'reject', reason: 'payment-plan' });
    expect(step.state.phase).toBe('no-alternative');
    expect(step.prompt.kind).toBe('no-alternative');
    expect(step.prompt.nextPropertyId).toBeUndefined();
    expect(step.prompt.text).toContain('payment plan');
    expect(step.prompt.text).toContain('couldn’t find another');
  });

  it('sends only the current property synthetic photos with localized alt text and notice', () => {
    const property = INVENTORY.find((item) => item.id === 'demo-north-coast-chalet-01')!;
    const start = beginPropertyFollowUp(property.id, SEARCH, 'en');
    const step = answerPropertyFollowUp(start.state, { type: 'send-photos' });
    expect(step.state).toEqual(start.state);
    expect(step.prompt.kind).toBe('photos');
    expect(step.prompt.text).toContain('synthetic demo photos');
    expect(step.prompt.text).toContain('illustrative');
    expect(step.prompt.photos).toHaveLength(property.photos.length);
    expect(step.prompt.photos?.map((photo) => photo.src)).toEqual(property.photos.map((photo) => photo.src));
    expect(step.prompt.photos?.every((photo) => photo.synthetic && photo.alt.length > 0)).toBe(true);
    expect(step.prompt.nextPropertyId).toBeUndefined();
  });

  it('localizes photo disclosure and rejection categories in Arabic', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'ar');
    const photos = answerPropertyFollowUp(start.state, { type: 'send-photos' });
    expect(photos.prompt.text).toContain('الصور التجريبية');
    expect(photos.prompt.photos?.[0].alt).toContain('صورة تجريبية');
    const explore = answerPropertyFollowUp(start.state, { type: 'explore' });
    expect(explore.prompt.text).toContain('السبب الأساسي');
    expect(explore.prompt.quickReplies.map((reply) => reply.label)).toContain('خطة السداد');
  });

  it('ignores out-of-order rejection actions without exposing an alternative', () => {
    const start = beginPropertyFollowUp(SELECTED, SEARCH, 'en');
    const invalid = answerPropertyFollowUp(start.state, { type: 'reject', reason: 'price' });
    expect(invalid.state).toEqual(start.state);
    expect(invalid.prompt.kind).toBe('decision');
    expect(invalid.prompt.nextPropertyId).toBeUndefined();
  });

  it('rejects an unknown current property instead of fabricating a confirmation or photo', () => {
    expect(() => beginPropertyFollowUp('missing-property', SEARCH, 'en')).toThrow(RangeError);
  });
});
