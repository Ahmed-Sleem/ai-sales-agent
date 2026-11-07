import { describe, expect, it } from 'vitest';
import { advanceDemoConversation, beginDemoConversation, getDemoQuickReplies, getDemoThinkingDelay, DEMO_MIN_THINKING_MS, DEMO_MAX_THINKING_MS } from '../../lib/demoConversation';

function qualify() {
  let session = beginDemoConversation('en');
  expect(session.assistantTurns[0].content).toMatch(/I'm Sara/);
  session = advanceDemoConversation(session.state, 'New Cairo');
  expect(session.assistantTurns[0].content).toMatch(/maximum budget/i);
  session = advanceDemoConversation(session.state, '8.5 million EGP');
  expect(session.assistantTurns[0].content).toMatch(/interior area/i);
  session = advanceDemoConversation(session.state, '160 square metres');
  expect(session.state.stage).toBe('disclosure');
  expect(session.assistantTurns.map((turn) => turn.content).join(' ')).toMatch(/Apartment 02.*Would you like to hear the price/i);
  return session;
}

describe('demo response pacing', () => {
  it('chooses a bounded random thinking delay from 200 to 1500 milliseconds', () => {
    expect(getDemoThinkingDelay(0)).toBe(DEMO_MIN_THINKING_MS);
    expect(getDemoThinkingDelay(1)).toBe(DEMO_MAX_THINKING_MS);
    expect(getDemoThinkingDelay(0.5)).toBeGreaterThanOrEqual(DEMO_MIN_THINKING_MS);
    expect(getDemoThinkingDelay(0.5)).toBeLessThanOrEqual(DEMO_MAX_THINKING_MS);
    expect(getDemoThinkingDelay(-1)).toBe(DEMO_MIN_THINKING_MS);
    expect(getDemoThinkingDelay(2)).toBe(DEMO_MAX_THINKING_MS);
  });
});

describe('demo conversation adapter for the shared chat', () => {
  it('starts with localized quick replies and advances typed input through qualification in the same state', () => {
    const started = beginDemoConversation('en');
    expect(getDemoQuickReplies(started.state).map((reply) => reply.label)).toContain('Cairo');
    const location = advanceDemoConversation(started.state, 'New Cairo');
    expect(location.state.stage).toBe('qualification');
    expect(location.state.qualification?.answers.location?.districtId).toBe('new-cairo');
    const budget = advanceDemoConversation(location.state, '8.5 million EGP');
    expect(budget.state.qualification?.answers.budgetMaxEgp).toBe(8_500_000);
    const completed = advanceDemoConversation(budget.state, '160 square metres');
    expect(completed.state.stage).toBe('disclosure');
    expect(completed.assistantTurns).toHaveLength(2);
    expect(completed.assistantTurns[0].content).toContain('Apartment 02');
    expect(completed.assistantTurns[1].content).toMatch(/Would you like to hear the price/i);
  });

  it('gates plans until installments and returns synthetic photos as assistant-turn metadata', () => {
    let session = qualify();
    expect(getDemoQuickReplies(session.state).map((reply) => reply.label)).toEqual(['Yes, continue']);
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-location');
    expect(session.assistantTurns[0].content).toMatch(/the price is/i);
    expect(session.assistantTurns[0].content).not.toMatch(/payment plan/i);
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    expect(session.assistantTurns.map((turn) => turn.content).join(' ')).toMatch(/prefer to buy in cash/i);
    expect(getDemoQuickReplies(session.state).map((reply) => reply.label)).toEqual(['Cash', 'Installments']);
    session = advanceDemoConversation(session.state, 'Installments', 'installments');
    expect(session.state.stage).toBe('follow-up');
    expect(session.assistantTurns[0].content).toMatch(/illustrative payment plans/i);
    expect(session.assistantTurns[0].content).toMatch(/15% down over 8 years/i);
    expect(session.assistantTurns[0].content).toMatch(/20% down over 10 years/i);
    const photoStep = advanceDemoConversation(session.state, 'Send demo photos', 'photos');
    expect(photoStep.assistantTurns[0].content).toMatch(/synthetic demo photos/i);
    expect(photoStep.assistantTurns[0].demoPhotos?.[0]).toMatchObject({ synthetic: true, src: expect.stringContaining('/images/properties/') });
  });

  it('routes confirm, explore, and no-match responses without changing the shared turn format', () => {
    let session = qualify();
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-location');
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    session = advanceDemoConversation(session.state, 'Cash', 'cash');
    expect(session.assistantTurns.map((turn) => turn.content).join(' ')).not.toMatch(/% down over \d+ years/i);
    expect(session.state.stage).toBe('follow-up');
    session = advanceDemoConversation(session.state, 'Confirm interest', 'confirm');
    expect(session.state.stage).toBe('done');
    expect(session.assistantTurns[0].content).toMatch(/recorded your interest/i);
    expect(getDemoQuickReplies(session.state)).toEqual([{ id: 'restart-demo', label: 'Start another search' }]);
    const done = advanceDemoConversation(session.state, 'hello');
    expect(done.assistantTurns[0].content).toMatch(/new conversation/i);
  });

  it('offers the closest same-area property transparently when strict budget preferences have no exact match', () => {
    let session = beginDemoConversation('en');
    session = advanceDemoConversation(session.state, 'Giza');
    session = advanceDemoConversation(session.state, '5 million EGP');
    session = advanceDemoConversation(session.state, '100 square metres');
    expect(session.state.stage).toBe('disclosure');
    expect(session.state.closestFallback).toBe(true);
    expect(session.assistantTurns[0].content).toMatch(/couldn’t find an exact match/i);
    expect(session.assistantTurns[0].content).toMatch(/Apartment 05/);
    expect(session.assistantTurns[0].content).toMatch(/not a live offer/i);
    expect(session.assistantTurns[0].content).not.toMatch(/EGP [\d,]+/);

    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-location');
    expect(session.assistantTurns[0].content).toMatch(/EGP\s+6,750,000/);
    expect(session.assistantTurns[0].content).toMatch(/above the EGP\s+5,000,000 budget/i);
    expect(session.assistantTurns[0].content).not.toMatch(/148 m²/);
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    expect(session.assistantTurns[0].content).toMatch(/148 m², larger than the approximate 100 m²/i);
  });

  it('does not end the Alexandria 8-million, 200-square-metre flow when there is no exact match', () => {
    let session = beginDemoConversation('en');
    session = advanceDemoConversation(session.state, 'Alexandria');
    session = advanceDemoConversation(session.state, 'EGP 8 million');
    session = advanceDemoConversation(session.state, 'About 200 m²');
    expect(session.state.stage).toBe('disclosure');
    expect(session.state.closestFallback).toBe(true);
    expect(session.assistantTurns[0].content).toMatch(/couldn’t find an exact match/i);
    expect(session.assistantTurns[0].content).toContain('Apartment 08');
    expect(session.assistantTurns[0].content).toMatch(/not a live offer/i);
    expect(session.assistantTurns[1].content).toMatch(/Would you like to hear the price/i);
  });

  it('finds and clearly marks the nearest alternative after the exact listing is rejected', () => {
    let session = beginDemoConversation('en');
    session = advanceDemoConversation(session.state, 'Alexandria');
    session = advanceDemoConversation(session.state, '5 million EGP');
    session = advanceDemoConversation(session.state, '100 square metres');
    expect(session.state.closestFallback).toBe(false);

    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-location');
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    session = advanceDemoConversation(session.state, 'Cash', 'cash');
    session = advanceDemoConversation(session.state, 'Explore another property', 'explore');
    session = advanceDemoConversation(session.state, 'Price', 'reason-price');

    expect(session.state.stage).toBe('disclosure');
    expect(session.state.closestFallback).toBe(true);
    expect(session.assistantTurns.map((turn) => turn.content).join(' ')).toMatch(/nearest other sample property is Apartment 07/i);
    expect(session.state.shownIds).toContain('demo-alexandria-apartment-02');
  });
});
