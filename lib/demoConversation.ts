import { INVENTORY } from '../data/catalogue';
import { searchCatalogue, searchClosestCatalogueMatch, type SearchRequest } from './catalogueSearch';
import { advancePropertyDisclosure, beginPropertyDisclosure, type PropertyDisclosureState, type PropertyDisclosureStep } from './propertyDisclosure';
import { answerPropertyFollowUp, beginPropertyFollowUp, getPropertyFollowUpPrompt, type PropertyFollowUpState, type RejectionRecord } from './propertyFollowUp';
import { parseDemoInput, type DemoNluResult } from './demoNlu';
import { answerQualification, beginQualification, type QualificationLanguage, type QualificationState } from './qualification';

export interface DemoConversationPhoto {
  readonly src: string;
  readonly alt: string;
  readonly synthetic: true;
}

export interface DemoAssistantTurn {
  readonly content: string;
  readonly demoPhotos?: readonly DemoConversationPhoto[];
}

export interface DemoQuickReply {
  readonly id: string;
  readonly label: string;
}

export type DemoConversationStage = 'qualification' | 'disclosure' | 'follow-up' | 'done';

export const DEMO_MIN_THINKING_MS = 200;
export const DEMO_MAX_THINKING_MS = 1500;
const LISTING_NOTE: Record<QualificationLanguage, string> = {
  en: 'This is an illustrative listing, not a live offer.',
  ar: 'ده إعلان توضيحي، مش عرض حقيقي.',
};

export function getDemoThinkingDelay(randomValue = Math.random()): number {
  const normalized = Math.max(0, Math.min(1, randomValue));
  return Math.floor(DEMO_MIN_THINKING_MS + normalized * (DEMO_MAX_THINKING_MS - DEMO_MIN_THINKING_MS));
}

export interface DemoConversationState {
  readonly language: QualificationLanguage;
  readonly stage: DemoConversationStage;
  readonly qualification: QualificationState | null;
  readonly disclosure: PropertyDisclosureState | null;
  readonly followUp: PropertyFollowUpState | null;
  readonly searchRequest: SearchRequest | null;
  readonly closestFallback: boolean;
  readonly shownIds: readonly string[];
  readonly rejections: readonly RejectionRecord[];
}

export interface DemoConversationStep {
  readonly state: DemoConversationState;
  readonly assistantTurns: readonly DemoAssistantTurn[];
}

function searchRequestFrom(state: QualificationState): SearchRequest | null {
  const { location, budgetMaxEgp, minAreaSqm } = state.answers;
  if (!location || budgetMaxEgp === undefined || minAreaSqm === undefined) return null;
  return {
    cityId: location.cityId,
    ...(location.districtId ? { districtId: location.districtId } : {}),
    ...(location.communityId ? { communityId: location.communityId } : {}),
    maxBudgetEgp: budgetMaxEgp,
    minAreaSqm,
    allowRelaxation: false,
  };
}

function isAction<K extends DemoNluResult['kind']>(
  result: DemoNluResult,
  kind: K,
): result is Extract<DemoNluResult, { kind: K }> {
  return result.kind === kind;
}

function assistantTurn(content: string, demoPhotos?: readonly DemoConversationPhoto[]): DemoAssistantTurn {
  return { content, ...(demoPhotos?.length ? { demoPhotos } : {}) };
}

function formatEgp(value: number, language: QualificationLanguage): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
  }).format(value);
}

function disclosureTextFor(step: PropertyDisclosureStep, state: DemoConversationState): string {
  const { prompt } = step;
  const property = INVENTORY.find((item) => item.id === step.state.propertyId);
  let text = prompt.text;

  if (property && state.closestFallback && state.searchRequest && prompt.kind === 'price'
    && state.searchRequest.maxBudgetEgp !== undefined && property.priceEgp > state.searchRequest.maxBudgetEgp) {
    text = state.language === 'ar'
      ? `سعرها ${formatEgp(property.priceEgp, state.language)}، وهو أعلى من ميزانيتك اللي ذكرتها (${formatEgp(state.searchRequest.maxBudgetEgp, state.language)}). تحب تعرف المساحة؟`
      : `The price is ${formatEgp(property.priceEgp, state.language)}, above the ${formatEgp(state.searchRequest.maxBudgetEgp, state.language)} budget you mentioned. Would you like to hear the area next?`;
  }

  if (property && state.closestFallback && state.searchRequest?.minAreaSqm !== undefined && prompt.kind === 'area') {
    const requestedArea = state.searchRequest.minAreaSqm;
    const difference = property.areaSqm - requestedArea;
    if (Math.abs(difference) >= Math.max(10, requestedArea * 0.2)) {
      text = state.language === 'ar'
        ? `مساحتها ${new Intl.NumberFormat('ar-EG').format(property.areaSqm)} متر مربع، ${difference > 0 ? 'أكبر' : 'أصغر'} من المساحة التقريبية اللي طلبتها (${new Intl.NumberFormat('ar-EG').format(requestedArea)} متر مربع). تفضل كاش ولا تقسيط؟`
        : `It’s ${property.areaSqm} m², ${difference > 0 ? 'larger' : 'smaller'} than the approximate ${requestedArea} m² you asked for. Would you prefer cash or installments?`;
    }
  }

  if (prompt.kind === 'payment-plans' && prompt.paymentPlans?.length) {
    const terms = prompt.paymentPlans.map((plan) => state.language === 'ar'
      ? `مقدم ${new Intl.NumberFormat('ar-EG').format(plan.downPaymentPercent)}٪ وتقسيط على ${new Intl.NumberFormat('ar-EG').format(plan.installmentYears)} سنوات`
      : `${plan.downPaymentPercent}% down over ${plan.installmentYears} years`);
    text = state.language === 'ar'
      ? `${prompt.text} ${terms.join(' أو ')}.`
      : `${prompt.text} ${terms.join(' or ')}.`;
  }
  return text;
}

export function beginDemoConversation(language: QualificationLanguage): DemoConversationStep {
  const initial = beginQualification(language);
  return {
    state: {
      language,
      stage: 'qualification',
      qualification: initial.state,
      disclosure: null,
      followUp: null,
      searchRequest: null,
      closestFallback: false,
      shownIds: [],
      rejections: [],
    },
    assistantTurns: [assistantTurn(initial.prompt.text)],
  };
}

export function getDemoQuickReplies(state: DemoConversationState): readonly DemoQuickReply[] {
  if (state.stage === 'qualification' && state.qualification) {
    return answerQualification(state.qualification, {}).prompt.quickReplies.map(({ id, label }) => ({ id, label }));
  }
  if (state.stage === 'disclosure' && state.disclosure) {
    const { phase, language } = state.disclosure;
    if (phase === 'location' || phase === 'price') {
      return [{ id: `continue-${phase}`, label: language === 'ar' ? 'أيوه، كمل' : 'Yes, continue' }];
    }
    if (phase === 'area') {
      return language === 'ar'
        ? [{ id: 'cash', label: 'كاش' }, { id: 'installments', label: 'تقسيط' }]
        : [{ id: 'cash', label: 'Cash' }, { id: 'installments', label: 'Installments' }];
    }
  }
  if (state.stage === 'follow-up' && state.followUp) {
    return getPropertyFollowUpPrompt(state.followUp).quickReplies.map(({ id, label }) => ({ id, label }));
  }
  if (state.stage === 'done') {
    return [{ id: 'restart-demo', label: state.language === 'ar' ? 'ابدأ بحثًا جديدًا' : 'Start another search' }];
  }
  return [];
}

export function advanceDemoConversation(
  state: DemoConversationState,
  text: string,
  quickReplyId?: string,
): DemoConversationStep {
  const clarificationText = (result: DemoNluResult) => result.kind === 'clarification' ? result.text : '';

  if (state.stage === 'done') {
    return {
      state,
      assistantTurns: [assistantTurn(state.language === 'ar'
        ? 'انتهى العرض التجريبي. ابدأ محادثة جديدة لتجربة أخرى.'
        : 'This demo is complete. Start a new conversation to try it again.')],
    };
  }

  if (state.stage === 'qualification' && state.qualification) {
    const parsed = parseDemoInput({ text, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'qualification', state: state.qualification });
    if (!isAction(parsed, 'qualification')) {
      return { state, assistantTurns: [assistantTurn(clarificationText(parsed))] };
    }
    const step = answerQualification(state.qualification, parsed.input);
    if (step.prompt.question !== null) {
      return { state: { ...state, qualification: step.state }, assistantTurns: [assistantTurn(step.prompt.text)] };
    }
    const request = searchRequestFrom(step.state);
    if (!request) {
      return {
        state: { ...state, qualification: step.state, stage: 'done' },
        assistantTurns: [assistantTurn(state.language === 'ar'
          ? 'محتاج أتأكد من المدينة والميزانية والمساحة قبل البحث.'
          : 'I need the city, budget, and area before I can search.')],
      };
    }
    const exactMatch = searchCatalogue(request).bestMatch;
    const property = exactMatch ?? searchClosestCatalogueMatch(request).bestMatch;
    if (!property) {
      return {
        state: { ...state, qualification: step.state, searchRequest: request, stage: 'done' },
        assistantTurns: [assistantTurn(state.language === 'ar'
          ? 'مش عندي وحدة تجريبية في المنطقة دي. تحب تفكر في منطقة قريبة؟'
          : 'I don’t have a sample listing in that area. Would you consider a nearby location?')],
      };
    }
    const closestFallback = !exactMatch;
    const disclosure = beginPropertyDisclosure(property.id, state.language);
    return {
      state: {
        ...state,
        qualification: step.state,
        stage: 'disclosure',
        searchRequest: request,
        closestFallback,
        shownIds: [property.id],
        disclosure: disclosure.state,
      },
      assistantTurns: [
        assistantTurn(state.language === 'ar'
          ? closestFallback
            ? `ملقتش اختيار مطابق لميزانيتك ومساحتك، لكن أقرب اختيار متاح هو ${property.title.ar}. ${LISTING_NOTE.ar}`
            : `لقيت اختيار قريب من طلبك: ${property.title.ar}. ${LISTING_NOTE.ar}`
          : closestFallback
            ? `I couldn’t find an exact match for your budget and area. The nearest sample property is ${property.title.en}. ${LISTING_NOTE.en}`
            : `I found one close match: ${property.title.en}. ${LISTING_NOTE.en}`),
        assistantTurn(disclosure.prompt.text),
      ],
    };
  }

  if (state.stage === 'disclosure' && state.disclosure) {
    const parsed = parseDemoInput({ text, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'disclosure', state: state.disclosure });
    if (!isAction(parsed, 'disclosure')) {
      return { state, assistantTurns: [assistantTurn(clarificationText(parsed))] };
    }
    const step = advancePropertyDisclosure(state.disclosure, parsed.action);
    if (step.state.phase !== 'complete' || !state.searchRequest) {
      return { state: { ...state, disclosure: step.state }, assistantTurns: [assistantTurn(disclosureTextFor(step, state))] };
    }
    const followUp = beginPropertyFollowUp(
      step.state.propertyId,
      state.searchRequest,
      state.language,
      state.shownIds,
      state.rejections,
    );
    return {
      state: { ...state, disclosure: step.state, followUp: followUp.state, stage: 'follow-up' },
      assistantTurns: [assistantTurn(disclosureTextFor(step, state)), assistantTurn(followUp.prompt.text)],
    };
  }

  if (state.stage === 'follow-up' && state.followUp) {
    const parsed = parseDemoInput({ text, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'follow-up', state: state.followUp });
    if (!isAction(parsed, 'follow-up')) {
      return { state, assistantTurns: [assistantTurn(clarificationText(parsed))] };
    }
    const step = answerPropertyFollowUp(state.followUp, parsed.action);
    if (step.prompt.kind === 'photos') {
      return { state: { ...state, followUp: step.state }, assistantTurns: [assistantTurn(step.prompt.text, step.prompt.photos)] };
    }
    if (step.state.phase === 'alternative-ready' && step.prompt.nextPropertyId && state.searchRequest) {
      const property = INVENTORY.find((item) => item.id === step.prompt.nextPropertyId);
      if (!property) {
        return {
          state: { ...state, followUp: step.state, stage: 'done' },
          assistantTurns: [assistantTurn(state.language === 'ar' ? 'لم أتمكن من فتح الاختيار التجريبي التالي.' : 'I could not open the next illustrative match.')],
        };
      }
      const disclosure = beginPropertyDisclosure(property.id, state.language);
      return {
        state: {
          ...state,
          stage: 'disclosure',
          followUp: step.state,
          disclosure: disclosure.state,
          shownIds: step.state.shownPropertyIds,
          rejections: step.state.rejections,
          closestFallback: step.prompt.nextPropertyIsClosestMatch ?? false,
        },
        assistantTurns: [
          assistantTurn(step.prompt.text),
          assistantTurn(state.language === 'ar'
            ? step.prompt.nextPropertyIsClosestMatch
              ? `أقرب اختيار تاني هو ${property.title.ar}، وممكن يكون خارج ميزانيتك أو مساحتك. ${LISTING_NOTE.ar}`
              : `لقيت اختيار تاني قريب من طلبك: ${property.title.ar}. ${LISTING_NOTE.ar}`
            : step.prompt.nextPropertyIsClosestMatch
              ? `The nearest other sample property is ${property.title.en}; it may be outside your budget or area. ${LISTING_NOTE.en}`
              : `I found another close match: ${property.title.en}. ${LISTING_NOTE.en}`),
          assistantTurn(disclosure.prompt.text),
        ],
      };
    }
    const done = step.state.phase === 'confirmed' || step.state.phase === 'no-alternative';
    return {
      state: {
        ...state,
        followUp: step.state,
        rejections: step.state.rejections,
        stage: done ? 'done' : state.stage,
      },
      assistantTurns: [assistantTurn(step.prompt.text)],
    };
  }

  return { state, assistantTurns: [assistantTurn(state.language === 'ar' ? 'ممكن توضحلي طلبك؟' : 'Could you clarify what you would like to do?')] };
}
