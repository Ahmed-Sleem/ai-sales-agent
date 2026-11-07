import { INVENTORY, INVENTORY_NOTICE } from '../data/catalogue';
import { searchCatalogue, type SearchRequest } from './catalogueSearch';
import { advancePropertyDisclosure, beginPropertyDisclosure, type PropertyDisclosureState } from './propertyDisclosure';
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

export interface DemoConversationState {
  readonly language: QualificationLanguage;
  readonly stage: DemoConversationStage;
  readonly qualification: QualificationState | null;
  readonly disclosure: PropertyDisclosureState | null;
  readonly followUp: PropertyFollowUpState | null;
  readonly searchRequest: SearchRequest | null;
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
        ? 'انتهى البحث التجريبي. اضغط «إعادة بدء التجربة» لبدء محادثة جديدة.'
        : 'This demo run is complete. Select “Restart demo” to begin a new conversation.')],
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
    const result = searchCatalogue(request);
    if (!result.bestMatch) {
      return {
        state: { ...state, qualification: step.state, searchRequest: request, stage: 'done' },
        assistantTurns: [assistantTurn(state.language === 'ar'
          ? 'ملقتش اختيار تجريبي مطابق لتفضيلاتك الحالية، ومش هغيّر شروطك من غير ما أسألك.'
          : 'I couldn’t find an illustrative match under those preferences, and I won’t change your criteria without asking.')],
      };
    }
    const property = result.bestMatch;
    const disclosure = beginPropertyDisclosure(property.id, state.language);
    return {
      state: {
        ...state,
        qualification: step.state,
        stage: 'disclosure',
        searchRequest: request,
        shownIds: [property.id],
        disclosure: disclosure.state,
      },
      assistantTurns: [
        assistantTurn(state.language === 'ar'
          ? `أقرب اختيار تجريبي واحد هو ${property.title.ar}. ${INVENTORY_NOTICE.ar}`
          : `The closest illustrative match is ${property.title.en}. ${INVENTORY_NOTICE.en}`),
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
      return { state: { ...state, disclosure: step.state }, assistantTurns: [assistantTurn(step.prompt.text)] };
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
      assistantTurns: [assistantTurn(step.prompt.text), assistantTurn(followUp.prompt.text)],
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
        },
        assistantTurns: [
          assistantTurn(step.prompt.text),
          assistantTurn(state.language === 'ar'
            ? `اختيار تجريبي آخر: ${property.title.ar}. ${INVENTORY_NOTICE.ar}`
            : `One other illustrative match: ${property.title.en}. ${INVENTORY_NOTICE.en}`),
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
