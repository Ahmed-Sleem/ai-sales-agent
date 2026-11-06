import { INVENTORY, type LocalizedText } from '../data/catalogue';

export type QualificationLanguage = 'ar' | 'en';
export type QualificationField = 'location' | 'budget' | 'area';
export type QualificationQuestion = 'greeting' | QualificationField | null;

export interface QualifiedLocation {
  readonly cityId: string;
  readonly cityName: LocalizedText;
  readonly districtId?: string;
  readonly districtName?: LocalizedText;
  readonly communityId?: string;
  readonly communityName?: LocalizedText;
}

export interface QualificationAnswers {
  readonly location?: QualifiedLocation;
  readonly budgetMaxEgp?: number;
  /** Minimum desired interior area in square metres. */
  readonly minAreaSqm?: number;
}

export interface QualificationState {
  readonly language: QualificationLanguage;
  readonly answers: QualificationAnswers;
}

export interface QualificationLocationInput {
  readonly cityId: string;
  readonly districtId?: string;
  readonly communityId?: string;
}

export interface QualificationInput {
  readonly location?: QualificationLocationInput;
  readonly budgetMaxEgp?: number;
  readonly minAreaSqm?: number;
}

export interface QualificationQuickReply {
  readonly id: string;
  readonly label: string;
  readonly answer: QualificationInput;
}

export interface QualificationPrompt {
  readonly question: QualificationQuestion;
  readonly text: string;
  readonly quickReplies: readonly QualificationQuickReply[];
  readonly clarification: boolean;
}

export interface QualificationStep {
  readonly state: QualificationState;
  readonly prompt: QualificationPrompt;
}

export const PDF_ARABIC_GREETING = 'وعليكم السلام معاك ساره مسؤلة قسم المبيعات, حضرتك بتدور على ايه بالضبط؟';
const ENGLISH_GREETING = "Peace be upon you. I'm Sara, the sales manager. What exactly are you looking for?";
const FIELD_ORDER: readonly QualificationField[] = ['location', 'budget', 'area'];
const MAX_REASONABLE_BUDGET_EGP = 1_000_000_000_000;
const MAX_REASONABLE_AREA_SQM = 1_000_000;

const BUDGET_REPLIES: Readonly<Record<QualificationLanguage, readonly QualificationQuickReply[]>> = {
  en: [
    { id: 'budget-5m', label: 'EGP 5 million', answer: { budgetMaxEgp: 5_000_000 } },
    { id: 'budget-8m', label: 'EGP 8 million', answer: { budgetMaxEgp: 8_000_000 } },
    { id: 'budget-12m', label: 'EGP 12 million', answer: { budgetMaxEgp: 12_000_000 } },
  ],
  ar: [
    { id: 'budget-5m', label: '٥ ملايين جنيه', answer: { budgetMaxEgp: 5_000_000 } },
    { id: 'budget-8m', label: '٨ ملايين جنيه', answer: { budgetMaxEgp: 8_000_000 } },
    { id: 'budget-12m', label: '١٢ مليون جنيه', answer: { budgetMaxEgp: 12_000_000 } },
  ],
};

const AREA_REPLIES: Readonly<Record<QualificationLanguage, readonly QualificationQuickReply[]>> = {
  en: [
    { id: 'area-100', label: 'About 100 m²', answer: { minAreaSqm: 100 } },
    { id: 'area-150', label: 'About 150 m²', answer: { minAreaSqm: 150 } },
    { id: 'area-200', label: 'About 200 m²', answer: { minAreaSqm: 200 } },
  ],
  ar: [
    { id: 'area-100', label: 'حوالي ١٠٠ م²', answer: { minAreaSqm: 100 } },
    { id: 'area-150', label: 'حوالي ١٥٠ م²', answer: { minAreaSqm: 150 } },
    { id: 'area-200', label: 'حوالي ٢٠٠ م²', answer: { minAreaSqm: 200 } },
  ],
};

function locationReplies(language: QualificationLanguage): QualificationQuickReply[] {
  const cities = new Map<string, LocalizedText>();
  for (const property of INVENTORY) cities.set(property.city.id, property.city.name);
  return [...cities.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cityId, name]) => ({
      id: `location-${cityId}`,
      label: name[language],
      answer: { location: { cityId } },
    }));
}

function normalizeLocation(input: QualificationLocationInput | undefined): QualifiedLocation | undefined {
  if (!input || typeof input.cityId !== 'string' || !input.cityId.trim()) return undefined;
  const property = INVENTORY.find((item) => item.city.id === input.cityId &&
    (!input.districtId || item.district.id === input.districtId) &&
    (!input.communityId || item.community.id === input.communityId));
  if (!property) return undefined;
  if (input.communityId && !input.districtId) return undefined;
  return {
    cityId: property.city.id,
    cityName: property.city.name,
    ...(input.districtId ? { districtId: property.district.id, districtName: property.district.name } : {}),
    ...(input.communityId ? { communityId: property.community.id, communityName: property.community.name } : {}),
  };
}

function isValidPositiveNumber(value: number | undefined, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= maximum;
}

function firstMissingField(answers: QualificationAnswers): QualificationField | null {
  for (const field of FIELD_ORDER) {
    if (field === 'location' && !answers.location) return field;
    if (field === 'budget' && answers.budgetMaxEgp === undefined) return field;
    if (field === 'area' && answers.minAreaSqm === undefined) return field;
  }
  return null;
}

function questionText(language: QualificationLanguage, field: QualificationField, clarification: boolean): string {
  if (language === 'ar') {
    if (field === 'location') return clarification
      ? 'مش قادر أحدد المدينة أو المنطقة من إجابتك. تقصد أنهي مدينة أو منطقة؟'
      : 'في أي مدينة أو منطقة بتدور؟';
    if (field === 'budget') return clarification
      ? 'اكتب ميزانية موجبة بالجنيه المصري. إيه الحد الأقصى المناسب ليك؟'
      : 'إيه الحد الأقصى لميزانيتك بالجنيه المصري؟';
    return clarification
      ? 'اكتب مساحة موجبة بالمتر المربع. إيه المساحة الداخلية المناسبة ليك؟'
      : 'إيه المساحة الداخلية التقريبية اللي تناسبك بالمتر المربع؟';
  }
  if (field === 'location') return clarification
    ? "I couldn't match that location. Which city or area do you mean?"
    : 'Which city or area are you looking in?';
  if (field === 'budget') return clarification
    ? 'Please enter a positive budget in EGP. What is your maximum budget?'
    : 'What is your maximum budget in Egyptian pounds?';
  return clarification
    ? 'Please enter a positive area. What interior area would suit you in square metres?'
    : 'What approximate interior area would suit you, in square metres?';
}

function repliesFor(language: QualificationLanguage, field: QualificationField): readonly QualificationQuickReply[] {
  if (field === 'location') return locationReplies(language);
  if (field === 'budget') return BUDGET_REPLIES[language];
  return AREA_REPLIES[language];
}

function buildPrompt(state: QualificationState, invalidFields: ReadonlySet<QualificationField> = new Set()): QualificationPrompt {
  const field = firstMissingField(state.answers);
  if (!field) {
    return {
      question: null,
      text: state.language === 'ar'
        ? 'تمام، وصلتني المنطقة والميزانية والمساحة. هبحث عن أقرب اختيار مناسب ليك.'
        : 'Thanks, I have your location, budget, and area. I will look for one closest match.',
      quickReplies: [],
      clarification: false,
    };
  }
  const clarification = invalidFields.has(field);
  return {
    question: field,
    text: questionText(state.language, field, clarification),
    quickReplies: repliesFor(state.language, field),
    clarification,
  };
}

/** Start a conversation with the PDF greeting; qualification questions follow after the visitor replies. */
export function beginQualification(language: QualificationLanguage): QualificationStep {
  const state: QualificationState = { language, answers: {} };
  return {
    state,
    prompt: {
      question: 'greeting',
      text: language === 'ar' ? PDF_ARABIC_GREETING : ENGLISH_GREETING,
      quickReplies: [],
      clarification: false,
    },
  };
}

/**
 * Store any valid facts the visitor supplied, even if they volunteered later fields early,
 * then ask only the first unanswered field in location → budget → area order.
 */
export function answerQualification(state: QualificationState, input: QualificationInput): QualificationStep {
  const invalid = new Set<QualificationField>();
  const answers: {
    location?: QualifiedLocation;
    budgetMaxEgp?: number;
    minAreaSqm?: number;
  } = { ...state.answers };

  if (input.location !== undefined) {
    const location = normalizeLocation(input.location);
    if (location) answers.location = location;
    else invalid.add('location');
  }
  if (input.budgetMaxEgp !== undefined) {
    if (isValidPositiveNumber(input.budgetMaxEgp, MAX_REASONABLE_BUDGET_EGP)) answers.budgetMaxEgp = input.budgetMaxEgp;
    else invalid.add('budget');
  }
  if (input.minAreaSqm !== undefined) {
    if (isValidPositiveNumber(input.minAreaSqm, MAX_REASONABLE_AREA_SQM)) answers.minAreaSqm = input.minAreaSqm;
    else invalid.add('area');
  }

  const nextState: QualificationState = { language: state.language, answers };
  return { state: nextState, prompt: buildPrompt(nextState, invalid) };
}
