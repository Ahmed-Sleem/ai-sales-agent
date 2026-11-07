/**
 * Deterministic, synthetic-only analytics fixtures and pure period aggregations for the demo dashboard.
 * No client information is collected, stored, or transmitted by this module.
 */
import { INVENTORY, type InventoryProperty, type LocalizedText } from './catalogue';

export type DemoPaymentPreference = 'cash' | 'installments' | 'undecided';
export type DemoLeadStage = 'new' | 'qualified' | 'confirmed' | 'closed-lost';
export type DemoRejectionReason = 'price' | 'location' | 'area' | 'payment_plan' | 'other';
export type DemoPropertyResponse = 'shown' | 'rejected' | 'confirmed';
export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface DemoLead {
  readonly id: string;
  readonly createdAt: string;
  readonly cityId: string;
  readonly districtId: string;
  readonly communityId: string;
  readonly paymentPreference: DemoPaymentPreference;
  readonly stage: DemoLeadStage;
  readonly synthetic: true;
}
export interface DemoPropertyInteraction {
  readonly propertyId: string;
  readonly response: DemoPropertyResponse;
  readonly rejectionReason?: DemoRejectionReason;
}
export interface DemoConversation {
  readonly id: string;
  readonly leadId: string;
  readonly startedAt: string;
  readonly clientMessageCount: number;
  readonly propertyInteractions: readonly DemoPropertyInteraction[];
  readonly synthetic: true;
}
export interface DemoAnalyticsDataset {
  readonly leads: readonly DemoLead[];
  readonly conversations: readonly DemoConversation[];
}

export const ANALYTICS_DEMO_NOTICE: LocalizedText = {
  en: 'Synthetic demo analytics only. These conversations, leads, preferences, and outcomes are illustrative and are not real client data.',
  ar: 'تحليلات تجريبية اصطناعية فقط. هذه المحادثات والعملاء والتفضيلات والنتائج توضيحية وليست بيانات عملاء حقيقية.',
};
export const DEMO_ANALYTICS_AS_OF = '2026-11-07T23:59:59.999Z';

const DAYS_AGO = [
  0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12,
  14, 15, 16, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 30, 35, 42, 49, 55,
] as const;
const REJECTION_REASONS: readonly DemoRejectionReason[] = ['price', 'location', 'area', 'payment_plan', 'other'];
const PAYMENT_PREFERENCES: readonly DemoPaymentPreference[] = ['cash', 'installments', 'undecided'];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const TOP_LIST_LIMIT = 5;

function generatedDate(daysAgo: number, index: number): string {
  return new Date(Date.UTC(2026, 10, 7 - daysAgo, 8 + (index % 9), (index * 11) % 60)).toISOString();
}
function stageFor(index: number): DemoLeadStage {
  if (index % 11 === 0) return 'confirmed';
  if (index % 7 === 0) return 'closed-lost';
  if (index % 4 === 0) return 'new';
  return 'qualified';
}
function primaryPropertyFor(index: number): InventoryProperty {
  const selectedIndex = index % 3 === 0 ? 0 : (index * 7 + Math.floor(index / 3)) % INVENTORY.length;
  return INVENTORY[selectedIndex];
}
function paymentPreferenceFor(index: number, stage: DemoLeadStage): DemoPaymentPreference {
  if (stage === 'new' || index % 5 === 0) return 'undecided';
  return PAYMENT_PREFERENCES[index % 2];
}
function propertyInteractionsFor(index: number, stage: DemoLeadStage): DemoPropertyInteraction[] {
  if (stage === 'new') return [];
  const property = primaryPropertyFor(index);
  const interactions: DemoPropertyInteraction[] = [];
  if (stage === 'confirmed') {
    interactions.push({ propertyId: property.id, response: 'confirmed' });
  } else if (stage === 'closed-lost' || index % 6 === 0) {
    interactions.push({
      propertyId: property.id,
      response: 'rejected',
      rejectionReason: REJECTION_REASONS[Math.floor(index / 3) % REJECTION_REASONS.length],
    });
  } else {
    interactions.push({ propertyId: property.id, response: 'shown' });
  }
  if (stage === 'qualified' && index % 3 === 1) {
    const alternative = INVENTORY[(index * 5 + 3) % INVENTORY.length];
    interactions.push({ propertyId: alternative.id, response: 'shown' });
  }
  return interactions;
}

/** Build the fixed sample from deterministic rules; no random or wall-clock values are used. */
export function createDemoAnalyticsDataset(): DemoAnalyticsDataset {
  const leads = DAYS_AGO.map((daysAgo, index): DemoLead => {
    const property = primaryPropertyFor(index);
    const stage = stageFor(index);
    return {
      id: `demo-lead-${String(index + 1).padStart(3, '0')}`,
      createdAt: generatedDate(daysAgo, index),
      cityId: property.city.id,
      districtId: property.district.id,
      communityId: property.community.id,
      paymentPreference: paymentPreferenceFor(index, stage),
      stage,
      synthetic: true,
    };
  });
  const conversations = leads.map((lead, index): DemoConversation => ({
    id: `demo-conversation-${String(index + 1).padStart(3, '0')}`,
    leadId: lead.id,
    startedAt: lead.createdAt,
    clientMessageCount: 2 + ((index * 7) % 11),
    propertyInteractions: propertyInteractionsFor(index, lead.stage),
    synthetic: true,
  }));
  return { leads, conversations };
}

export const DEMO_ANALYTICS_DATASET = createDemoAnalyticsDataset();

const PAYMENT_VALUES: readonly DemoPaymentPreference[] = ['cash', 'installments', 'undecided'];
const STAGE_VALUES: readonly DemoLeadStage[] = ['new', 'qualified', 'confirmed', 'closed-lost'];
const RESPONSE_VALUES: readonly DemoPropertyResponse[] = ['shown', 'rejected', 'confirmed'];
const REASON_VALUES: readonly DemoRejectionReason[] = ['price', 'location', 'area', 'payment_plan', 'other'];
const PROPERTY_BY_ID = new Map<string, InventoryProperty>(INVENTORY.map((property) => [property.id, property]));

function validTimestamp(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}
function hasCatalogueLocation(lead: DemoLead): boolean {
  return INVENTORY.some((property) => property.city.id === lead.cityId && property.district.id === lead.districtId && property.community.id === lead.communityId);
}

/** Return validation errors for injected or edited demo fixtures before aggregation. */
export function validateDemoAnalyticsDataset(dataset: DemoAnalyticsDataset): string[] {
  const errors: string[] = [];
  if (!dataset || typeof dataset !== 'object' || !Array.isArray(dataset.leads) || !Array.isArray(dataset.conversations)) return ['dataset must contain leads and conversations arrays'];
  const leadsById = new Map<string, DemoLead>();
  const conversationIds = new Set<string>();

  for (const candidate of dataset.leads as readonly unknown[]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push('invalid-lead-record');
      continue;
    }
    const lead = candidate as DemoLead;
    if (typeof lead.id !== 'string' || !lead.id.trim() || leadsById.has(lead.id)) errors.push(`duplicate-or-empty-lead-id:${String(lead.id)}`);
    if (typeof lead.id !== 'string' || !lead.id.trim()) continue;
    leadsById.set(lead.id, lead);
    if (!lead.synthetic) errors.push(`lead-not-synthetic:${lead.id}`);
    if (!validTimestamp(lead.createdAt)) errors.push(`invalid-lead-date:${lead.id}`);
    if (!hasCatalogueLocation(lead)) errors.push(`unknown-lead-location:${lead.id}`);
    if (!PAYMENT_VALUES.includes(lead.paymentPreference)) errors.push(`invalid-payment-preference:${lead.id}`);
    if (!STAGE_VALUES.includes(lead.stage)) errors.push(`invalid-lead-stage:${lead.id}`);
  }

  for (const candidate of dataset.conversations as readonly unknown[]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push('invalid-conversation-record');
      continue;
    }
    const conversation = candidate as DemoConversation;
    if (typeof conversation.id !== 'string' || !conversation.id.trim() || conversationIds.has(conversation.id)) errors.push(`duplicate-or-empty-conversation-id:${String(conversation.id)}`);
    if (typeof conversation.id === 'string') conversationIds.add(conversation.id);
    if (!conversation.synthetic) errors.push(`conversation-not-synthetic:${String(conversation.id)}`);
    if (!leadsById.has(conversation.leadId)) errors.push(`unknown-conversation-lead:${conversation.id}`);
    if (!validTimestamp(conversation.startedAt)) errors.push(`invalid-conversation-date:${conversation.id}`);
    if (!Number.isInteger(conversation.clientMessageCount) || conversation.clientMessageCount < 0) errors.push(`invalid-message-count:${conversation.id}`);
    if (!Array.isArray(conversation.propertyInteractions)) {
      errors.push(`invalid-property-interactions:${conversation.id}`);
      continue;
    }
    for (const candidateInteraction of conversation.propertyInteractions as readonly unknown[]) {
      if (!candidateInteraction || typeof candidateInteraction !== 'object' || Array.isArray(candidateInteraction)) {
        errors.push(`invalid-property-interaction:${conversation.id}`);
        continue;
      }
      const interaction = candidateInteraction as DemoPropertyInteraction;
      if (!PROPERTY_BY_ID.has(interaction.propertyId)) errors.push(`unknown-property:${conversation.id}:${interaction.propertyId}`);
      if (!RESPONSE_VALUES.includes(interaction.response)) errors.push(`invalid-property-response:${conversation.id}`);
      if (interaction.response === 'rejected') {
        if (!interaction.rejectionReason || !REASON_VALUES.includes(interaction.rejectionReason)) errors.push(`missing-rejection-reason:${conversation.id}`);
      } else if (interaction.rejectionReason !== undefined) {
        errors.push(`unexpected-rejection-reason:${conversation.id}`);
      }
    }
  }

  const validConversations = dataset.conversations.filter((item): item is DemoConversation => Boolean(item) && typeof item === 'object' && Array.isArray(item.propertyInteractions));
  for (const lead of leadsById.values()) {
    const related = validConversations.filter((conversation) => conversation.leadId === lead.id);
    if (lead.stage === 'confirmed' && !related.some((conversation) => conversation.propertyInteractions.some((item) => item?.response === 'confirmed'))) {
      errors.push(`confirmed-lead-without-confirmation:${lead.id}`);
    }
    if (lead.stage === 'closed-lost' && !related.some((conversation) => conversation.propertyInteractions.some((item) => item?.response === 'rejected'))) {
      errors.push(`closed-lost-lead-without-rejection:${lead.id}`);
    }
  }
  return errors;
}

export interface AnalyticsSeriesPoint {
  readonly date: string;
  readonly clients: number;
  readonly conversations: number;
  readonly clientMessages: number;
}
export interface HotProperty {
  readonly id: string;
  readonly name: LocalizedText;
  readonly community: LocalizedText;
  readonly interactions: number;
  readonly rejections: number;
  readonly confirmations: number;
}
export interface HotLocation {
  readonly id: string;
  readonly name: LocalizedText;
  readonly city: LocalizedText;
  readonly clients: number;
}
export interface AnalyticsPeriodSummary {
  readonly period: AnalyticsPeriod;
  readonly startDate: string;
  readonly endDate: string;
  readonly clients: number;
  readonly conversations: number;
  readonly clientMessages: number;
  readonly leadStages: Readonly<Record<DemoLeadStage, number>>;
  readonly paymentPreferences: Readonly<Record<DemoPaymentPreference, number>>;
  readonly propertyInteractions: number;
  readonly rejections: number;
  readonly rejectionReasons: Readonly<Record<DemoRejectionReason, number>>;
  readonly hotProperties: readonly HotProperty[];
  readonly hotLocations: readonly HotLocation[];
  readonly series: readonly AnalyticsSeriesPoint[];
}
export interface AnalyticsSnapshot {
  readonly synthetic: true;
  readonly notice: LocalizedText;
  readonly asOf: string;
  readonly periods: Readonly<Record<AnalyticsPeriod, AnalyticsPeriodSummary>>;
}

function startOfPeriodUTC(asOf: Date, period: AnalyticsPeriod): Date {
  const dayStart = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  if (period === 'day') return new Date(dayStart);
  if (period === 'week') {
    const daysSinceMonday = (asOf.getUTCDay() + 6) % 7;
    return new Date(dayStart - daysSinceMonday * MILLISECONDS_PER_DAY);
  }
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
}
function dateKey(timestamp: Date): string {
  return timestamp.toISOString().slice(0, 10);
}
function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}
function findLocation(districtId: string): { name: LocalizedText; city: LocalizedText } | null {
  const property = INVENTORY.find((item) => item.district.id === districtId);
  return property ? { name: property.district.name, city: property.city.name } : null;
}

function aggregatePeriod(dataset: DemoAnalyticsDataset, period: AnalyticsPeriod, asOf: Date): AnalyticsPeriodSummary {
  const start = startOfPeriodUTC(asOf, period);
  const endOfDay = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1) - 1);
  const periodEnd = asOf < endOfDay ? asOf : endOfDay;
  const startMs = start.getTime();
  const endMs = periodEnd.getTime();
  const allConversations = dataset.conversations.filter((conversation) => {
    const time = Date.parse(conversation.startedAt);
    return time >= startMs && time <= endMs;
  });
  const leadIds = new Set(allConversations.map((conversation) => conversation.leadId));
  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const periodLeads = [...leadIds].map((id) => leadsById.get(id)).filter((lead): lead is DemoLead => Boolean(lead));
  const leadStages = zeroRecord(STAGE_VALUES);
  const paymentPreferences = zeroRecord(PAYMENT_VALUES);
  const rejectionReasons = zeroRecord(REASON_VALUES);
  for (const lead of periodLeads) {
    leadStages[lead.stage] += 1;
    paymentPreferences[lead.paymentPreference] += 1;
  }

  const propertyCounts = new Map<string, { interactions: number; rejections: number; confirmations: number }>();
  let totalRejections = 0;
  for (const conversation of allConversations) {
    for (const interaction of conversation.propertyInteractions) {
      const counts = propertyCounts.get(interaction.propertyId) ?? { interactions: 0, rejections: 0, confirmations: 0 };
      counts.interactions += 1;
      if (interaction.response === 'rejected') {
        counts.rejections += 1;
        totalRejections += 1;
        if (interaction.rejectionReason) rejectionReasons[interaction.rejectionReason] += 1;
      }
      if (interaction.response === 'confirmed') counts.confirmations += 1;
      propertyCounts.set(interaction.propertyId, counts);
    }
  }
  const hotProperties = [...propertyCounts.entries()]
    .map(([id, counts]): HotProperty | null => {
      const property = PROPERTY_BY_ID.get(id);
      return property ? { id, name: property.title, community: property.community.name, ...counts } : null;
    })
    .filter((item): item is HotProperty => item !== null)
    .sort((a, b) => b.interactions - a.interactions || a.id.localeCompare(b.id, 'en'))
    .slice(0, TOP_LIST_LIMIT);

  const locationCounts = new Map<string, number>();
  for (const lead of periodLeads) locationCounts.set(lead.districtId, (locationCounts.get(lead.districtId) ?? 0) + 1);
  const hotLocations = [...locationCounts.entries()]
    .map(([id, clients]): HotLocation | null => {
      const location = findLocation(id);
      return location ? { id, name: location.name, city: location.city, clients } : null;
    })
    .filter((item): item is HotLocation => item !== null)
    .sort((a, b) => b.clients - a.clients || a.id.localeCompare(b.id, 'en'))
    .slice(0, TOP_LIST_LIMIT);

  const series: AnalyticsSeriesPoint[] = [];
  for (let cursor = startMs; cursor <= endMs; cursor += MILLISECONDS_PER_DAY) {
    const key = dateKey(new Date(cursor));
    const bucket = allConversations.filter((conversation) => dateKey(new Date(Date.parse(conversation.startedAt))) === key);
    series.push({
      date: key,
      clients: new Set(bucket.map((conversation) => conversation.leadId)).size,
      conversations: bucket.length,
      clientMessages: bucket.reduce((sum, conversation) => sum + conversation.clientMessageCount, 0),
    });
  }

  return {
    period,
    startDate: dateKey(start),
    endDate: dateKey(periodEnd),
    clients: leadIds.size,
    conversations: allConversations.length,
    clientMessages: allConversations.reduce((sum, conversation) => sum + conversation.clientMessageCount, 0),
    leadStages,
    paymentPreferences,
    propertyInteractions: [...propertyCounts.values()].reduce((sum, counts) => sum + counts.interactions, 0),
    rejections: totalRejections,
    rejectionReasons,
    hotProperties,
    hotLocations,
    series,
  };
}

/** Aggregate synthetic activity into the current UTC calendar day, Monday-start week, and month. */
export function aggregateDemoAnalytics(options: {
  readonly dataset?: DemoAnalyticsDataset;
  readonly asOf?: string;
} = {}): AnalyticsSnapshot {
  const dataset = options.dataset ?? DEMO_ANALYTICS_DATASET;
  const errors = validateDemoAnalyticsDataset(dataset);
  if (errors.length) throw new Error(`Invalid demo analytics dataset: ${errors.join('; ')}`);
  const asOfValue = options.asOf ?? DEMO_ANALYTICS_AS_OF;
  const isIsoDateTime = typeof asOfValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(asOfValue);
  const asOfMs = isIsoDateTime ? Date.parse(asOfValue) : Number.NaN;
  if (!Number.isFinite(asOfMs)) throw new RangeError('asOf must be a valid ISO date-time string');
  const asOf = new Date(asOfMs);
  return {
    synthetic: true,
    notice: ANALYTICS_DEMO_NOTICE,
    asOf: asOf.toISOString(),
    periods: {
      day: aggregatePeriod(dataset, 'day', asOf),
      week: aggregatePeriod(dataset, 'week', asOf),
      month: aggregatePeriod(dataset, 'month', asOf),
    },
  };
}
