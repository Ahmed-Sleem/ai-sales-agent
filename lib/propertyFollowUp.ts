import { INVENTORY, INVENTORY_NOTICE, type InventoryProperty } from '../data/catalogue';
import { searchCatalogue, type SearchRequest } from './catalogueSearch';
import type { QualificationLanguage } from './qualification';

export type RejectionReason = 'price' | 'location' | 'area' | 'payment-plan' | 'other';
export type PropertyFollowUpPhase = 'decision' | 'rejection-reason' | 'confirmed' | 'alternative-ready' | 'no-alternative';
export type PropertyFollowUpPromptKind = PropertyFollowUpPhase | 'photos';

export interface RejectionRecord {
  readonly propertyId: string;
  readonly reason: RejectionReason;
  readonly detail?: string;
}

export interface PropertyFollowUpState {
  readonly currentPropertyId: string;
  readonly language: QualificationLanguage;
  readonly searchRequest: SearchRequest;
  readonly shownPropertyIds: readonly string[];
  readonly rejections: readonly RejectionRecord[];
  readonly phase: PropertyFollowUpPhase;
  readonly alternativePropertyId?: string;
}

export type PropertyFollowUpAction =
  | { readonly type: 'confirm' }
  | { readonly type: 'explore' }
  | { readonly type: 'reject'; readonly reason: RejectionReason; readonly detail?: string }
  | { readonly type: 'send-photos' };

export interface PropertyFollowUpQuickReply {
  readonly id: string;
  readonly label: string;
  readonly action: PropertyFollowUpAction;
}

export interface DisclosedPhoto {
  readonly src: string;
  readonly alt: string;
  readonly synthetic: true;
}

export interface PropertyFollowUpPrompt {
  readonly kind: PropertyFollowUpPromptKind;
  readonly text: string;
  readonly quickReplies: readonly PropertyFollowUpQuickReply[];
  readonly nextPropertyId?: string;
  readonly photos?: readonly DisclosedPhoto[];
}

export interface PropertyFollowUpStep {
  readonly state: PropertyFollowUpState;
  readonly prompt: PropertyFollowUpPrompt;
}

const REJECTION_REASONS: readonly RejectionReason[] = ['price', 'location', 'area', 'payment-plan', 'other'];
const MAX_REJECTION_DETAIL_LENGTH = 240;

function getProperty(propertyId: string): InventoryProperty {
  const property = INVENTORY.find((item) => item.id === propertyId);
  if (!property) throw new RangeError(`Unknown synthetic property: ${propertyId}`);
  return property;
}

function reasonLabel(reason: RejectionReason, language: QualificationLanguage): string {
  const labels: Record<RejectionReason, { en: string; ar: string }> = {
    price: { en: 'price', ar: 'السعر' },
    location: { en: 'location', ar: 'الموقع' },
    area: { en: 'area', ar: 'المساحة' },
    'payment-plan': { en: 'payment plan', ar: 'خطة السداد' },
    other: { en: 'something else', ar: 'سبب آخر' },
  };
  return labels[reason][language];
}

function decisionReplies(language: QualificationLanguage): readonly PropertyFollowUpQuickReply[] {
  return language === 'ar'
    ? [
        { id: 'confirm', label: 'تأكيد الاهتمام', action: { type: 'confirm' } },
        { id: 'explore', label: 'استكشاف اختيار آخر', action: { type: 'explore' } },
        { id: 'photos', label: 'إرسال الصور التوضيحية', action: { type: 'send-photos' } },
      ]
    : [
        { id: 'confirm', label: 'Confirm interest', action: { type: 'confirm' } },
        { id: 'explore', label: 'Explore another', action: { type: 'explore' } },
        { id: 'photos', label: 'Send demo photos', action: { type: 'send-photos' } },
      ];
}

function rejectionReplies(language: QualificationLanguage): readonly PropertyFollowUpQuickReply[] {
  return REJECTION_REASONS.map((reason) => ({
    id: `reason-${reason}`,
    label: reasonLabel(reason, language),
    action: { type: 'reject', reason },
  }));
}

function promptFor(state: PropertyFollowUpState): PropertyFollowUpPrompt {
  const property = getProperty(state.currentPropertyId);
  const ar = state.language === 'ar';
  if (state.phase === 'decision') {
    return {
      kind: 'decision',
      text: ar
        ? 'تحب تأكد اهتمامك بالوحدة دي ولا تستكشف اختيار تاني؟'
        : 'Would you like to confirm interest in this property or explore another one?',
      quickReplies: decisionReplies(state.language),
    };
  }
  if (state.phase === 'rejection-reason') {
    return {
      kind: 'rejection-reason',
      text: ar
        ? 'إيه السبب الأساسي إن الوحدة دي مش مناسبة ليك؟'
        : 'What is the main reason this property is not suitable for you?',
      quickReplies: rejectionReplies(state.language),
    };
  }
  if (state.phase === 'confirmed') {
    return {
      kind: 'confirmed',
      text: ar
        ? `سجلت اهتمامك بـ ${property.title.ar}.`
        : `I recorded your interest in ${property.title.en}.`,
      quickReplies: [],
    };
  }
  if (state.phase === 'alternative-ready' && state.alternativePropertyId) {
    const rejection = state.rejections[state.rejections.length - 1];
    return {
      kind: 'alternative-ready',
      text: ar
        ? `سجلت إن ${reasonLabel(rejection.reason, state.language)} كان السبب. هعرض عليك اختيار تجريبي واحد تاني دلوقتي.`
        : `I noted that ${reasonLabel(rejection.reason, state.language)} was the issue. I’ll show you one other illustrative match next.`,
      quickReplies: [],
      nextPropertyId: state.alternativePropertyId,
    };
  }
  const rejection = state.rejections[state.rejections.length - 1];
  return {
    kind: 'no-alternative',
    text: ar
      ? `سجلت إن ${reasonLabel(rejection.reason, state.language)} كان السبب، لكن ملقتش اختيار تجريبي تاني مطابق لتفضيلاتك الحالية.`
      : `I noted that ${reasonLabel(rejection.reason, state.language)} was the issue, but I couldn’t find another illustrative match under your current preferences.`,
    quickReplies: [],
  };
}

function photoPrompt(state: PropertyFollowUpState): PropertyFollowUpPrompt {
  const property = getProperty(state.currentPropertyId);
  const notice = INVENTORY_NOTICE[state.language];
  return {
    kind: 'photos',
    text: state.language === 'ar'
      ? `دي الصور التجريبية التوضيحية لـ ${property.title.ar}. ${notice}`
      : `Here are the synthetic demo photos for ${property.title.en}. ${notice}`,
    quickReplies: [],
    photos: property.photos.map((photo) => ({
      src: photo.src,
      alt: photo.alt[state.language],
      synthetic: true,
    })),
  };
}

/** Read the current localized prompt without advancing the follow-up state. */
export function getPropertyFollowUpPrompt(state: PropertyFollowUpState): PropertyFollowUpPrompt {
  getProperty(state.currentPropertyId);
  return promptFor(state);
}

/** Start the confirm-or-explore step for the one property just disclosed. */
export function beginPropertyFollowUp(
  currentPropertyId: string,
  searchRequest: SearchRequest,
  language: QualificationLanguage,
  previouslyShownIds: readonly string[] = [],
  priorRejections: readonly RejectionRecord[] = [],
): PropertyFollowUpStep {
  getProperty(currentPropertyId);
  const state: PropertyFollowUpState = {
    currentPropertyId,
    language,
    searchRequest,
    shownPropertyIds: [...new Set([...previouslyShownIds, currentPropertyId])],
    rejections: [...priorRejections],
    phase: 'decision',
  };
  return { state, prompt: promptFor(state) };
}

/** Record the visitor's decision/reason and select at most one unseen catalogue alternative. */
export function answerPropertyFollowUp(
  state: PropertyFollowUpState,
  action: PropertyFollowUpAction,
): PropertyFollowUpStep {
  getProperty(state.currentPropertyId);
  if (action.type === 'send-photos') return { state, prompt: photoPrompt(state) };

  if (state.phase === 'decision' && action.type === 'confirm') {
    const nextState: PropertyFollowUpState = { ...state, phase: 'confirmed' };
    return { state: nextState, prompt: promptFor(nextState) };
  }
  if (state.phase === 'decision' && action.type === 'explore') {
    const nextState: PropertyFollowUpState = { ...state, phase: 'rejection-reason' };
    return { state: nextState, prompt: promptFor(nextState) };
  }
  if (state.phase === 'rejection-reason' && action.type === 'reject') {
    if (!REJECTION_REASONS.includes(action.reason)) return { state, prompt: promptFor(state) };
    const detail = action.detail?.trim();
    if (detail && detail.length > MAX_REJECTION_DETAIL_LENGTH) return { state, prompt: promptFor(state) };
    const rejection: RejectionRecord = {
      propertyId: state.currentPropertyId,
      reason: action.reason,
      ...(detail ? { detail } : {}),
    };
    const rejections = [...state.rejections, rejection];
    const excludeIds = [...new Set([...(state.searchRequest.excludeIds ?? []), ...state.shownPropertyIds])];
    const result = searchCatalogue({ ...state.searchRequest, excludeIds });
    const alternative = result.bestMatch;
    const nextState: PropertyFollowUpState = alternative
      ? {
          ...state,
          phase: 'alternative-ready',
          rejections,
          shownPropertyIds: [...new Set([...state.shownPropertyIds, alternative.id])],
          alternativePropertyId: alternative.id,
        }
      : { ...state, phase: 'no-alternative', rejections };
    return { state: nextState, prompt: promptFor(nextState) };
  }
  return { state, prompt: promptFor(state) };
}
