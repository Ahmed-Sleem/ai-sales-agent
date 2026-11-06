import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import {
  advancePropertyDisclosure,
  beginPropertyDisclosure,
  type PropertyDisclosureStep,
} from '../../lib/propertyDisclosure';

function questionCount(step: PropertyDisclosureStep): number {
  return (step.prompt.text.match(/[?؟]/g) ?? []).length;
}

function revealArea(propertyId: string = INVENTORY[0].id, language: 'ar' | 'en' = 'en'): PropertyDisclosureStep {
  const location = beginPropertyDisclosure(propertyId, language);
  const price = advancePropertyDisclosure(location.state, { type: 'continue' });
  return advancePropertyDisclosure(price.state, { type: 'continue' });
}

describe('staged property disclosure and payment gate', () => {
  it('starts with only the selected property location and one price question', () => {
    const property = INVENTORY[0];
    const step = beginPropertyDisclosure(property.id, 'en');
    expect(step.state).toMatchObject({ propertyId: property.id, phase: 'location', language: 'en' });
    expect(step.prompt.kind).toBe('location');
    expect(step.prompt.text).toContain(property.city.name.en);
    expect(step.prompt.text).toContain(property.district.name.en);
    expect(step.prompt.text).toContain(property.community.name.en);
    expect(step.prompt.text).toContain('price');
    expect(step.prompt.text).not.toContain(property.priceEgp.toLocaleString('en-EG'));
    expect(step.prompt.text).not.toContain(`${property.areaSqm} m²`);
    expect(step.prompt.paymentPlans).toBeUndefined();
    expect(questionCount(step)).toBe(1);
  });

  it('reveals price next, without location, area, or payment-plan terms', () => {
    const property = INVENTORY[0];
    const location = beginPropertyDisclosure(property.id, 'en');
    const price = advancePropertyDisclosure(location.state, { type: 'continue' });
    expect(price.state.phase).toBe('price');
    expect(price.prompt.kind).toBe('price');
    expect(price.prompt.text).toMatch(/7,200,000/);
    expect(price.prompt.text).toContain('area');
    expect(price.prompt.text).not.toContain(property.city.name.en);
    expect(price.prompt.text).not.toContain(`${property.areaSqm} m²`);
    expect(price.prompt.paymentPlans).toBeUndefined();
    expect(questionCount(price)).toBe(1);
  });

  it('reveals area after price, then asks exactly one cash-versus-installments question', () => {
    const property = INVENTORY[0];
    const step = revealArea(property.id);
    expect(step.state.phase).toBe('area');
    expect(step.prompt.kind).toBe('area');
    expect(step.prompt.text).toContain('140 m²');
    expect(step.prompt.text).toMatch(/cash/i);
    expect(step.prompt.text).toMatch(/installment/i);
    expect(step.prompt.text).not.toContain('7,200,000');
    expect(step.prompt.text).not.toContain(property.city.name.en);
    expect(step.prompt.paymentPlans).toBeUndefined();
    expect(questionCount(step)).toBe(1);
  });

  it('keeps the payment gate closed for out-of-order preference and continue actions', () => {
    const location = beginPropertyDisclosure(INVENTORY[0].id, 'en');
    const earlyPreference = advancePropertyDisclosure(location.state, { type: 'payment-preference', preference: 'installments' });
    expect(earlyPreference.state.phase).toBe('location');
    expect(earlyPreference.prompt.kind).toBe('location');
    expect(earlyPreference.prompt.paymentPlans).toBeUndefined();

    const area = revealArea();
    const skipPreference = advancePropertyDisclosure(area.state, { type: 'continue' });
    expect(skipPreference.state.phase).toBe('area');
    expect(skipPreference.prompt.kind).toBe('area');
    expect(skipPreference.prompt.paymentPlans).toBeUndefined();
  });

  it('records cash and never returns installment-plan details', () => {
    const area = revealArea();
    const cash = advancePropertyDisclosure(area.state, { type: 'payment-preference', preference: 'cash' });
    expect(cash.state).toMatchObject({ phase: 'complete', paymentPreference: 'cash' });
    expect(cash.prompt.kind).toBe('cash-confirmation');
    expect(cash.prompt.text).toMatch(/cash/i);
    expect(cash.prompt.paymentPlans).toBeUndefined();
    expect(cash.prompt.text).not.toContain('Illustrative 8-year plan');
  });

  it('reveals only the chosen listing plans after installments is selected', () => {
    const property = INVENTORY.find((item) => item.id === 'demo-cairo-apartment-02')!;
    const area = revealArea(property.id);
    expect(area.prompt.paymentPlans).toBeUndefined();
    const installment = advancePropertyDisclosure(area.state, { type: 'payment-preference', preference: 'installments' });
    expect(installment.state).toMatchObject({ phase: 'complete', paymentPreference: 'installments', propertyId: property.id });
    expect(installment.prompt.kind).toBe('payment-plans');
    expect(installment.prompt.paymentPlans).toEqual([
      { label: 'Illustrative 8-year plan', downPaymentPercent: 15, installmentYears: 8 },
      { label: 'Illustrative 10-year plan', downPaymentPercent: 20, installmentYears: 10 },
    ]);
    expect(installment.prompt.paymentPlans?.every((plan) => !('monthlyAmount' in plan))).toBe(true);
    expect(installment.prompt.text).not.toContain('7,200,000');
  });

  it('localizes location, price, area, payment question, and plan text in Arabic', () => {
    const property = INVENTORY[0];
    const location = beginPropertyDisclosure(property.id, 'ar');
    expect(location.prompt.text).toContain(property.city.name.ar);
    expect(location.prompt.text).toContain('السعر');
    expect(questionCount(location)).toBe(1);
    const price = advancePropertyDisclosure(location.state, { type: 'continue' });
    expect(price.prompt.text).toContain('٧٬٢٠٠٬٠٠٠');
    expect(price.prompt.text).toContain('المساحة');
    expect(questionCount(price)).toBe(1);
    const area = advancePropertyDisclosure(price.state, { type: 'continue' });
    expect(area.prompt.text).toContain('١٤٠ متر مربع');
    expect(area.prompt.text).toContain('كاش');
    expect(area.prompt.text).toContain('تقسيط');
    expect(questionCount(area)).toBe(1);
    const plans = advancePropertyDisclosure(area.state, { type: 'payment-preference', preference: 'installments' });
    expect(plans.prompt.paymentPlans?.[0].label).toBe('خطة سداد توضيحية على ٨ سنوات');
  });

  it('rejects unknown properties instead of inventing details', () => {
    expect(() => beginPropertyDisclosure('missing-property', 'en')).toThrow(RangeError);
  });

  it('does not replay plan details when a completed state receives another action', () => {
    const area = revealArea();
    const plan = advancePropertyDisclosure(area.state, { type: 'payment-preference', preference: 'installments' });
    const repeat = advancePropertyDisclosure(plan.state, { type: 'continue' });
    expect(repeat.prompt.kind).toBe('complete');
    expect(repeat.prompt.paymentPlans).toBeUndefined();
  });
});
