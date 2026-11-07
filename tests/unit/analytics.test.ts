import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../../data/catalogue';
import {
  aggregateDemoAnalytics,
  ANALYTICS_DEMO_NOTICE,
  createDemoAnalyticsDataset,
  DEMO_ANALYTICS_DATASET,
  DEMO_ANALYTICS_AS_OF,
  validateDemoAnalyticsDataset,
  type DemoConversation,
  type DemoLead,
  type DemoAnalyticsDataset,
} from '../../data/analytics';

function lead(
  id: string,
  propertyIndex: number,
  createdAt: string,
  paymentPreference: DemoLead['paymentPreference'],
  stage: DemoLead['stage'],
): DemoLead {
  const property = INVENTORY[propertyIndex];
  return {
    id,
    createdAt,
    cityId: property.city.id,
    districtId: property.district.id,
    communityId: property.community.id,
    paymentPreference,
    stage,
    synthetic: true,
  };
}
function conversation(
  id: string,
  leadId: string,
  startedAt: string,
  clientMessageCount: number,
  propertyInteractions: DemoConversation['propertyInteractions'],
): DemoConversation {
  return { id, leadId, startedAt, clientMessageCount, propertyInteractions, synthetic: true };
}
function smallDataset(): DemoAnalyticsDataset {
  const leads = [
    lead('lead-a', 0, '2026-11-05T10:00:00.000Z', 'cash', 'qualified'),
    lead('lead-b', 1, '2026-11-05T11:00:00.000Z', 'installments', 'closed-lost'),
    lead('lead-c', 7, '2026-11-05T12:00:00.000Z', 'cash', 'confirmed'),
  ];
  const conversations = [
    conversation('conversation-a1', 'lead-a', '2026-11-05T10:10:00.000Z', 3, [
      { propertyId: INVENTORY[1].id, response: 'shown' },
      { propertyId: INVENTORY[1].id, response: 'rejected', rejectionReason: 'price' },
    ]),
    conversation('conversation-a2', 'lead-a', '2026-11-05T10:30:00.000Z', 2, [
      { propertyId: INVENTORY[1].id, response: 'shown' },
    ]),
    conversation('conversation-b', 'lead-b', '2026-11-05T11:10:00.000Z', 4, [
      { propertyId: INVENTORY[0].id, response: 'rejected', rejectionReason: 'location' },
    ]),
    conversation('conversation-c', 'lead-c', '2026-11-05T12:10:00.000Z', 5, [
      { propertyId: INVENTORY[7].id, response: 'confirmed' },
    ]),
  ];
  return { leads, conversations };
}

describe('synthetic analytics dataset and aggregation', () => {
  it('generates the same synthetic-only fixture on every call', () => {
    const first = createDemoAnalyticsDataset();
    const second = createDemoAnalyticsDataset();
    expect(first).toEqual(second);
    expect(first.leads.length).toBeGreaterThan(30);
    expect(first.conversations).toHaveLength(first.leads.length);
    expect(first.leads.every((item) => item.synthetic && item.id.startsWith('demo-lead-'))).toBe(true);
    expect(first.conversations.every((item) => item.synthetic && item.id.startsWith('demo-conversation-'))).toBe(true);
    expect(first.leads.some((item) => 'name' in item || 'email' in item || 'phone' in item)).toBe(false);
    expect(validateDemoAnalyticsDataset(DEMO_ANALYTICS_DATASET)).toEqual([]);
  });

  it('labels the dataset clearly in English and Arabic', () => {
    expect(ANALYTICS_DEMO_NOTICE.en).toContain('Synthetic demo analytics only');
    expect(ANALYTICS_DEMO_NOTICE.ar).toContain('اصطناعية');
    const snapshot = aggregateDemoAnalytics();
    expect(snapshot.synthetic).toBe(true);
    expect(snapshot.notice).toEqual(ANALYTICS_DEMO_NOTICE);
  });

  it('uses deterministic UTC calendar-day, Monday-week, and calendar-month windows', () => {
    const first = aggregateDemoAnalytics();
    const second = aggregateDemoAnalytics();
    expect(first).toEqual(second);
    expect(first.asOf).toBe(DEMO_ANALYTICS_AS_OF);
    expect(first.periods.day).toMatchObject({ startDate: '2026-11-07', endDate: '2026-11-07', clients: 3 });
    expect(first.periods.week).toMatchObject({ startDate: '2026-11-02', endDate: '2026-11-07', clients: 10 });
    expect(first.periods.month).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-07', clients: 11 });
    expect(first.periods.day.series).toHaveLength(1);
    expect(first.periods.week.series).toHaveLength(6);
    expect(first.periods.month.series).toHaveLength(7);
  });

  it('counts distinct clients separately from conversations and reconciles period totals', () => {
    const dataset = smallDataset();
    const snapshot = aggregateDemoAnalytics({ dataset, asOf: '2026-11-05T23:59:59.999Z' });
    const day = snapshot.periods.day;
    const week = snapshot.periods.week;
    expect(day).toMatchObject({ clients: 3, conversations: 4, clientMessages: 14, propertyInteractions: 5, rejections: 2 });
    expect(Object.values(day.leadStages).reduce((sum, count) => sum + count, 0)).toBe(day.clients);
    expect(Object.values(day.paymentPreferences).reduce((sum, count) => sum + count, 0)).toBe(day.clients);
    expect(Object.values(day.rejectionReasons).reduce((sum, count) => sum + count, 0)).toBe(day.rejections);
    expect(week.clients).toBe(3);
    expect(week.conversations).toBe(4);
    expect(week.series.reduce((sum, point) => sum + point.conversations, 0)).toBe(week.conversations);
    expect(week.series.reduce((sum, point) => sum + point.clientMessages, 0)).toBe(week.clientMessages);
  });

  it('derives hot property and location rankings from interactions and lead data', () => {
    const day = aggregateDemoAnalytics({ dataset: smallDataset(), asOf: '2026-11-05T23:59:59.999Z' }).periods.day;
    expect(day.hotProperties[0]).toMatchObject({
      id: INVENTORY[1].id,
      interactions: 3,
      rejections: 1,
    });
    expect(day.hotProperties.some((property) => property.id === INVENTORY[0].id && property.rejections === 1)).toBe(true);
    expect(day.hotLocations[0]).toMatchObject({ id: 'new-cairo', clients: 2 });
    expect(day.hotLocations.every((location) => typeof location.name.en === 'string' && typeof location.city.en === 'string')).toBe(true);
  });

  it('derives payment preferences and rejection reasons from the fixture', () => {
    const day = aggregateDemoAnalytics({ dataset: smallDataset(), asOf: '2026-11-05T23:59:59.999Z' }).periods.day;
    expect(day.paymentPreferences).toEqual({ cash: 2, installments: 1, undecided: 0 });
    expect(day.rejectionReasons).toMatchObject({ price: 1, location: 1, area: 0, payment_plan: 0, other: 0 });
  });

  it('validates canonical catalogue references and rejects malformed fixtures', () => {
    const valid = smallDataset();
    expect(validateDemoAnalyticsDataset(valid)).toEqual([]);
    const malformed = {
      ...valid,
      leads: [{ ...valid.leads[0], districtId: 'not-a-real-district' }, ...valid.leads.slice(1)],
      conversations: [{
        ...valid.conversations[0],
        propertyInteractions: [{ propertyId: 'not-a-real-property', response: 'rejected' }],
      }, ...valid.conversations.slice(1)],
    } as unknown as DemoAnalyticsDataset;
    expect(validateDemoAnalyticsDataset(malformed)).toEqual(expect.arrayContaining([
      'unknown-lead-location:lead-a',
      'unknown-property:conversation-a1:not-a-real-property',
      'missing-rejection-reason:conversation-a1',
    ]));
    expect(() => aggregateDemoAnalytics({ dataset: malformed })).toThrow('Invalid demo analytics dataset');
    const malformedRecords = { leads: [null], conversations: [null] } as unknown as DemoAnalyticsDataset;
    expect(validateDemoAnalyticsDataset(malformedRecords)).toEqual(expect.arrayContaining(['invalid-lead-record', 'invalid-conversation-record']));
  });

  it('rejects invalid dates, enums, message counts, and duplicate record IDs', () => {
    const valid = smallDataset();
    const malformed = {
      leads: [
        { ...valid.leads[0], createdAt: 'bad-date', paymentPreference: 'crypto' },
        valid.leads[1], valid.leads[2],
      ],
      conversations: [
        { ...valid.conversations[0], clientMessageCount: -1 },
        { ...valid.conversations[1], id: valid.conversations[0].id },
        ...valid.conversations.slice(2),
      ],
    } as unknown as DemoAnalyticsDataset;
    expect(validateDemoAnalyticsDataset(malformed)).toEqual(expect.arrayContaining([
      'invalid-lead-date:lead-a',
      'invalid-payment-preference:lead-a',
      'invalid-message-count:conversation-a1',
      'duplicate-or-empty-conversation-id:conversation-a1',
    ]));
  });

  it('honors the as-of instant and excludes later same-day conversations', () => {
    const snapshot = aggregateDemoAnalytics({ dataset: smallDataset(), asOf: '2026-11-05T10:20:00.000Z' });
    expect(snapshot.periods.day.conversations).toBe(1);
    expect(snapshot.periods.day.clients).toBe(1);
    expect(snapshot.periods.day.clientMessages).toBe(3);
  });

  it('rejects invalid as-of dates rather than silently using the current clock', () => {
    expect(() => aggregateDemoAnalytics({ asOf: 'not-a-date' })).toThrow('asOf must be a valid ISO date-time string');
    expect(() => aggregateDemoAnalytics({ asOf: '2026-11-05' })).toThrow('asOf must be a valid ISO date-time string');
  });
});
