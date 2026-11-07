import { INVENTORY, type InventoryProperty, type PaymentPlan } from '../data/catalogue';
import type { QualificationLanguage } from './qualification';

export type PaymentPreference = 'cash' | 'installments';
export type DisclosurePhase = 'location' | 'price' | 'area' | 'complete';
export type DisclosurePromptKind = 'location' | 'price' | 'area' | 'payment-plans' | 'cash-confirmation' | 'complete';

export interface PropertyDisclosureState {
  readonly propertyId: string;
  readonly language: QualificationLanguage;
  /** The next fact to reveal; payment-plan details are never a phase before preference is recorded. */
  readonly phase: DisclosurePhase;
  readonly paymentPreference?: PaymentPreference;
}

export interface DisclosedPaymentPlan {
  readonly label: string;
  readonly downPaymentPercent: number;
  readonly installmentYears: number;
}

export interface PropertyDisclosurePrompt {
  readonly kind: DisclosurePromptKind;
  readonly text: string;
  /** Only present after an installments choice has been recorded. */
  readonly paymentPlans?: readonly DisclosedPaymentPlan[];
}

export interface PropertyDisclosureStep {
  readonly state: PropertyDisclosureState;
  readonly prompt: PropertyDisclosurePrompt;
}

export type PropertyDisclosureAction =
  | { readonly type: 'continue' }
  | { readonly type: 'payment-preference'; readonly preference: PaymentPreference };

function findProperty(propertyId: string): InventoryProperty {
  const property = INVENTORY.find((item) => item.id === propertyId);
  if (!property) throw new RangeError(`Unknown synthetic property: ${propertyId}`);
  return property;
}

function locationText(property: InventoryProperty, language: QualificationLanguage): string {
  return [property.community.name[language], property.district.name[language], property.city.name[language]].join(language === 'ar' ? '، ' : ', ');
}

function formatPrice(priceEgp: number, language: QualificationLanguage): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(priceEgp);
}

function plansFor(property: InventoryProperty, language: QualificationLanguage): readonly DisclosedPaymentPlan[] {
  return property.paymentPlans.map((plan: PaymentPlan) => ({
    label: plan.label[language],
    downPaymentPercent: plan.downPaymentPercent,
    installmentYears: plan.installmentYears,
  }));
}

function promptFor(state: PropertyDisclosureState, property: InventoryProperty): PropertyDisclosurePrompt {
  const language = state.language;
  if (state.phase === 'location') {
    return {
      kind: 'location',
      text: language === 'ar'
        ? `الوحدة في ${locationText(property, language)}. تحب تعرف سعرها؟`
        : `It’s in ${locationText(property, language)}. Would you like to hear the price?`,
    };
  }
  if (state.phase === 'price') {
    return {
      kind: 'price',
      text: language === 'ar'
        ? `سعرها ${formatPrice(property.priceEgp, language)}. تحب تعرف المساحة؟`
        : `The price is ${formatPrice(property.priceEgp, language)}. Would you like to hear the area next?`,
    };
  }
  if (state.phase === 'area') {
    return {
      kind: 'area',
      text: language === 'ar'
        ? `المساحة الداخلية ${new Intl.NumberFormat('ar-EG').format(property.areaSqm)} متر مربع. تفضل الشراء كاش ولا أبحث لك عن خطة تقسيط مناسبة؟`
        : `The interior area is ${property.areaSqm} m². Would you prefer to buy in cash or should I find a suitable installment plan?`,
    };
  }

  if (state.paymentPreference === 'cash') {
    return {
      kind: 'cash-confirmation',
      text: language === 'ar' ? 'تمام، سجلت إنك تفضل الشراء كاش.' : 'Understood — I have noted that you prefer to buy in cash.',
    };
  }
  if (state.paymentPreference === 'installments') {
    const plans = plansFor(property, language);
    return plans.length
      ? {
          kind: 'payment-plans',
          text: language === 'ar' ? 'دي خطط السداد التوضيحية المتاحة للوحدة:' : 'These are the illustrative payment plans available for this listing:',
          paymentPlans: plans,
        }
      : {
          kind: 'payment-plans',
          text: language === 'ar' ? 'مفيش خطة تقسيط توضيحية متاحة للوحدة دي.' : 'There is no illustrative installment plan available for this listing.',
          paymentPlans: [],
        };
  }
  return {
    kind: 'complete',
    text: language === 'ar' ? 'وصلنا لنهاية تفاصيل الوحدة.' : 'We have reached the end of this listing’s details.',
  };
}

/** Read the current localized prompt without advancing the disclosure state. */
export function getPropertyDisclosurePrompt(state: PropertyDisclosureState): PropertyDisclosurePrompt {
  return promptFor(state, findProperty(state.propertyId));
}

/** Start staged disclosure for exactly one catalogue property; no price, area, or plans are returned yet. */
export function beginPropertyDisclosure(propertyId: string, language: QualificationLanguage): PropertyDisclosureStep {
  const state: PropertyDisclosureState = { propertyId, language, phase: 'location' };
  return { state, prompt: promptFor(state, findProperty(propertyId)) };
}

/** Reveal one fact per step. Plans can only be produced by an explicit installments choice after area. */
export function advancePropertyDisclosure(
  state: PropertyDisclosureState,
  action: PropertyDisclosureAction,
): PropertyDisclosureStep {
  const property = findProperty(state.propertyId);
  if (state.phase === 'complete') {
    return {
      state,
      prompt: {
        kind: 'complete',
        text: state.language === 'ar' ? 'وصلنا لنهاية تفاصيل الوحدة.' : 'We have reached the end of this listing’s details.',
      },
    };
  }

  if (action.type === 'continue' && state.phase === 'location') {
    const nextState: PropertyDisclosureState = { ...state, phase: 'price' };
    return { state: nextState, prompt: promptFor(nextState, property) };
  }
  if (action.type === 'continue' && state.phase === 'price') {
    const nextState: PropertyDisclosureState = { ...state, phase: 'area' };
    return { state: nextState, prompt: promptFor(nextState, property) };
  }
  if (action.type === 'payment-preference' && state.phase === 'area') {
    const nextState: PropertyDisclosureState = {
      ...state,
      phase: 'complete',
      paymentPreference: action.preference,
    };
    return { state: nextState, prompt: promptFor(nextState, property) };
  }

  // Ignore an out-of-order input. Re-render only the current fact; never skip ahead or leak plans.
  return { state, prompt: promptFor(state, property) };
}
