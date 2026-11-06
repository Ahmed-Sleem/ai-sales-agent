import { INVENTORY } from '../data/catalogue';
import type { PropertyDisclosureAction, PropertyDisclosureState } from './propertyDisclosure';
import { getPropertyDisclosurePrompt } from './propertyDisclosure';
import type { PropertyFollowUpAction, PropertyFollowUpState, RejectionReason } from './propertyFollowUp';
import { getPropertyFollowUpPrompt } from './propertyFollowUp';
import type { QualificationInput, QualificationLanguage, QualificationState } from './qualification';
import { answerQualification } from './qualification';

export type DemoNluContext =
  | { readonly kind: 'qualification'; readonly state: QualificationState }
  | { readonly kind: 'disclosure'; readonly state: PropertyDisclosureState }
  | { readonly kind: 'follow-up'; readonly state: PropertyFollowUpState };

export type DemoNluResult =
  | { readonly kind: 'qualification'; readonly input: QualificationInput }
  | { readonly kind: 'disclosure'; readonly action: PropertyDisclosureAction }
  | { readonly kind: 'follow-up'; readonly action: PropertyFollowUpAction }
  | { readonly kind: 'clarification'; readonly text: string };

export interface DemoNluInput {
  readonly text: string;
  /** Stable button ID from the current prompt; when supplied it is checked against the active state. */
  readonly quickReplyId?: string;
}

const ARABIC_DIGITS: Readonly<Record<string, string>> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};
const MAX_REASON_DETAIL_LENGTH = 240;
const MAX_DEMO_INPUT_LENGTH = 500;

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalize(text).includes(normalize(phrase)));
}

function languageOf(context: DemoNluContext): QualificationLanguage {
  return context.state.language;
}

function clarification(context: DemoNluContext, text?: string): DemoNluResult {
  if (text) return { kind: 'clarification', text };
  const language = languageOf(context);
  if (context.kind === 'qualification') {
    const state = context.state;
    if (state.answers.location && state.answers.budgetMaxEgp !== undefined && state.answers.minAreaSqm !== undefined) {
      return { kind: 'clarification', text: language === 'ar' ? 'وصلتني كل التفاصيل. هل تحب أبدأ البحث؟' : 'I have the details. Shall I start the search?' };
    }
    const current = answerQualification(state, {}).prompt;
    if (current.question === 'location') return { kind: 'clarification', text: answerQualification(state, { location: { cityId: '__unknown__' } }).prompt.text };
    if (current.question === 'budget') return { kind: 'clarification', text: answerQualification(state, { budgetMaxEgp: 0 }).prompt.text };
    if (current.question === 'area') return { kind: 'clarification', text: answerQualification(state, { minAreaSqm: 0 }).prompt.text };
    return { kind: 'clarification', text: current.text };
  }
  if (context.kind === 'disclosure') return { kind: 'clarification', text: getPropertyDisclosurePrompt(context.state).text };
  return { kind: 'clarification', text: getPropertyFollowUpPrompt(context.state).text };
}

function parseNumericTokens(raw: string): number[] {
  const grouped = raw
    .normalize('NFKC')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (value) => value.replace(/,/g, ''));
  return [...grouped.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map((match) => Number(match[0].replace(',', '.')))
    .filter(Number.isFinite);
}

function cityAliases(cityId: string): readonly string[] {
  const aliases: Record<string, readonly string[]> = {
    cairo: ['cairo', 'القاهرة', 'القاهره'],
    'giza-west': ['giza', 'west cairo', 'giza west', 'الجيزة', 'غرب القاهرة', 'غرب القاهره'],
    alexandria: ['alexandria', 'الاسكندرية', 'اسكندرية', 'اسكندريه'],
    'north-coast': ['north coast', 'north-coast', 'الساحل الشمالي', 'الساحل الشمالى'],
  };
  return aliases[cityId] ?? [];
}

function locationAliases(): Array<{ phrase: string; cityId: string; districtId?: string }> {
  const entries = new Map<string, { phrase: string; cityId: string; districtId?: string }>();
  for (const property of INVENTORY) {
    for (const phrase of [property.city.name.en, property.city.name.ar, ...cityAliases(property.city.id)]) {
      entries.set(`${property.city.id}:city:${normalize(phrase)}`, { phrase, cityId: property.city.id });
    }
    for (const phrase of [property.district.name.en, property.district.name.ar]) {
      entries.set(`${property.city.id}:${property.district.id}:${normalize(phrase)}`, {
        phrase,
        cityId: property.city.id,
        districtId: property.district.id,
      });
    }
  }
  return [...entries.values()].sort((a, b) => normalize(b.phrase).length - normalize(a.phrase).length);
}

function parseLocation(text: string): QualificationInput['location'] | null | 'ambiguous' {
  const normalized = normalize(text);
  const matches = locationAliases().filter(({ phrase }) => normalized.includes(normalize(phrase)));
  if (!matches.length) return null;
  const districts = [...new Map(matches.filter((match) => match.districtId).map((match) => [match.districtId, match])).values()];
  if (districts.length > 1) return 'ambiguous';
  if (districts.length === 1) {
    const district = districts[0];
    const cities = new Set(matches.filter((match) => !match.districtId).map((match) => match.cityId));
    if ([...cities].some((cityId) => cityId !== district.cityId)) return 'ambiguous';
    return { cityId: district.cityId, districtId: district.districtId };
  }
  const cityIds = [...new Set(matches.map((match) => match.cityId))];
  return cityIds.length === 1 ? { cityId: cityIds[0] } : 'ambiguous';
}

function parseBudget(text: string): number | null {
  const values = parseNumericTokens(text);
  if (values.length !== 1) return null;
  const normalized = normalize(text);
  const hasMillionUnit = /\bmillion\b|\bmn\b|\d(?:[.,]\d+)?\s*m\b|مليون|ملايين/.test(normalized);
  const hasThousandUnit = /\bthousand\b|\d(?:[.,]\d+)?\s*k\b|الف|الاف/.test(normalized);
  if (hasMillionUnit && hasThousandUnit) return null;
  const value = values[0] * (hasMillionUnit ? 1_000_000 : hasThousandUnit ? 1_000 : 1);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000_000) return null;
  if (!hasMillionUnit && !hasThousandUnit && value < 10_000) return null;
  return Math.round(value);
}

function parseArea(text: string): number | null {
  const normalized = normalize(text);
  if (/\b(?:ft|feet|sqft|square feet)\b|قدم/.test(normalized)) return null;
  const values = parseNumericTokens(text);
  if (values.length !== 1) return null;
  const value = values[0];
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return value;
}

function matchQuickReply<T>(
  text: string,
  quickReplyId: string | undefined,
  replies: readonly { id: string; label: string; value: T }[],
): T | undefined {
  if (quickReplyId) return replies.find((reply) => reply.id === quickReplyId)?.value;
  const normalized = normalize(text);
  return replies.find((reply) => normalized === normalize(reply.id) || normalized === normalize(reply.label))?.value;
}

function qualificationResult(input: QualificationInput): DemoNluResult {
  return { kind: 'qualification', input };
}

function parseQualification(text: string, context: Extract<DemoNluContext, { kind: 'qualification' }>, quickReplyId?: string): DemoNluResult {
  const state = context.state;
  const current = answerQualification(state, {}).prompt;
  const replies = current.quickReplies.map((reply) => ({ id: reply.id, label: reply.label, value: reply.answer }));
  const quick = matchQuickReply(text, quickReplyId, replies);
  if (quick) return qualificationResult(quick);
  if (quickReplyId) return clarification(context);

  const question = current.question;
  if (question === 'greeting' || question === 'location') {
    const location = parseLocation(text);
    return location && location !== 'ambiguous'
      ? qualificationResult({ location })
      : clarification(context, question === 'greeting'
        ? state.language === 'ar' ? 'في أي مدينة أو منطقة بتدور؟' : 'Which city or area are you looking in?'
        : undefined);
  }
  if (question === 'budget') {
    const budgetMaxEgp = parseBudget(text);
    return budgetMaxEgp ? qualificationResult({ budgetMaxEgp }) : clarification(context);
  }
  if (question === 'area') {
    const minAreaSqm = parseArea(text);
    return minAreaSqm ? qualificationResult({ minAreaSqm }) : clarification(context);
  }
  return clarification(context);
}

function parseYes(text: string): boolean {
  return includesAny(text, ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'continue', 'next', 'please do', 'نعم', 'ايوه', 'أيوه', 'اه', 'أه', 'تمام', 'ماشي', 'كمل', 'كملي', 'تابع']);
}

function paymentPreference(text: string): 'cash' | 'installments' | 'ambiguous' | null {
  const normalized = normalize(text);
  const cash = includesAny(normalized, ['cash', 'pay cash', 'كاش', 'نقدا', 'نقدي']);
  const installments = includesAny(normalized, ['installment', 'installments', 'payment plan', 'pay in installments', 'تقسيط', 'أقساط', 'قسط', 'خطة سداد', 'خطة تقسيط']);
  if (cash && installments) return 'ambiguous';
  if (cash) return 'cash';
  if (installments) return 'installments';
  return null;
}

function parseDisclosure(text: string, context: Extract<DemoNluContext, { kind: 'disclosure' }>, quickReplyId?: string): DemoNluResult {
  const state = context.state;
  if (state.phase === 'area') {
    if (quickReplyId && !['cash', 'payment-cash', 'installments', 'payment-installments'].includes(quickReplyId)) return clarification(context);
    const preference = quickReplyId === 'cash' || quickReplyId === 'payment-cash'
      ? 'cash'
      : quickReplyId === 'installments' || quickReplyId === 'payment-installments'
        ? 'installments'
        : paymentPreference(text);
    if (preference === 'cash' || preference === 'installments') {
      return { kind: 'disclosure', action: { type: 'payment-preference', preference } };
    }
    return clarification(context);
  }
  if ((state.phase === 'location' || state.phase === 'price') && quickReplyId && !['continue', `continue-${state.phase}`].includes(quickReplyId)) return clarification(context);
  if ((state.phase === 'location' || state.phase === 'price') && (quickReplyId === 'continue' || quickReplyId === `continue-${state.phase}` || parseYes(text))) {
    return { kind: 'disclosure', action: { type: 'continue' } };
  }
  return clarification(context);
}

const REASON_TERMS: Readonly<Record<RejectionReason, readonly string[]>> = {
  price: ['price', 'expensive', 'too much', 'cost', 'high price', 'غالي', 'غالية', 'السعر', 'ميزانية'],
  location: ['location', 'far', 'place', 'district', 'موقع', 'بعيد', 'المكان', 'المنطقة'],
  area: ['area', 'size', 'small', 'larger', 'square metre', 'square meter', 'مساحة', 'المساحة', 'صغير', 'كبيرة'],
  'payment-plan': ['installment', 'payment plan', 'down payment', 'cash', 'تقسيط', 'سداد', 'قسط', 'مقدم', 'كاش'],
  other: ['other', 'something else', 'غير كده', 'سبب آخر', 'سبب اخر', 'أخرى'],
};

function parseFollowUp(text: string, context: Extract<DemoNluContext, { kind: 'follow-up' }>, quickReplyId?: string): DemoNluResult {
  const state = context.state;
  if (state.phase === 'decision') {
    if (quickReplyId && !['confirm', 'explore', 'photos', 'send-photos'].includes(quickReplyId)) return clarification(context);
    if (quickReplyId) {
      if (quickReplyId === 'confirm') return { kind: 'follow-up', action: { type: 'confirm' } };
      if (quickReplyId === 'explore') return { kind: 'follow-up', action: { type: 'explore' } };
      return { kind: 'follow-up', action: { type: 'send-photos' } };
    }
    const actions: PropertyFollowUpAction[] = [];
    if (includesAny(text, ['confirm', 'confirm interest', 'interested', 'تأكيد', 'اكد', 'أكد', 'مهتم', 'أؤكد'])) actions.push({ type: 'confirm' });
    if (includesAny(text, ['explore', 'another', 'different property', 'other option', 'not suitable', 'غير مناسب', 'اختيار تاني', 'اختيار اخر', 'استكشف', 'غيره'])) actions.push({ type: 'explore' });
    if (includesAny(text, ['photo', 'photos', 'picture', 'pictures', 'image', 'صور', 'صورة', 'الصور'])) actions.push({ type: 'send-photos' });
    return actions.length === 1 ? { kind: 'follow-up', action: actions[0] } : clarification(context);
  }
  if (state.phase === 'rejection-reason') {
    const quickReason = quickReplyId?.startsWith('reason-') ? quickReplyId.slice('reason-'.length) : undefined;
    if (quickReplyId && (!quickReason || !(Object.keys(REASON_TERMS) as string[]).includes(quickReason))) return clarification(context);
    const matched = (Object.keys(REASON_TERMS) as RejectionReason[]).filter((reason) =>
      reason === quickReason || REASON_TERMS[reason].some((term) => includesAny(text, [term])),
    );
    if (matched.length > 1) return clarification(context);
    const raw = text.trim();
    const reason: RejectionReason = matched[0] ?? 'other';
    const isCategoryOnly = Object.values(REASON_TERMS).some((terms) => terms.some((term) => normalize(raw) === normalize(term)));
    const detail = quickReason || isCategoryOnly ? undefined : raw;
    if (detail && detail.length > MAX_REASON_DETAIL_LENGTH) return clarification(context);
    return { kind: 'follow-up', action: { type: 'reject', reason, ...(detail ? { detail } : {}) } };
  }
  if (quickReplyId === 'photos' || includesAny(text, ['photos', 'صور', 'صورة', 'photo'])) {
    return { kind: 'follow-up', action: { type: 'send-photos' } };
  }
  return clarification(context);
}

/** Deterministic, offline-only demo parser. It maps only the active prompt to a typed state action. */
export function parseDemoInput(input: DemoNluInput, context: DemoNluContext): DemoNluResult {
  if (typeof input.text !== 'string' || input.text.trim().length === 0 || input.text.length > MAX_DEMO_INPUT_LENGTH) return clarification(context);
  if (context.kind === 'qualification') return parseQualification(input.text, context, input.quickReplyId);
  if (context.kind === 'disclosure') return parseDisclosure(input.text, context, input.quickReplyId);
  return parseFollowUp(input.text, context, input.quickReplyId);
}
