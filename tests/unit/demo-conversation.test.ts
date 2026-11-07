import { describe, expect, it } from 'vitest';
import { advanceDemoConversation, beginDemoConversation, getDemoQuickReplies } from '../../lib/demoConversation';

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
    expect(session.assistantTurns[0].content).toMatch(/illustrative price/i);
    expect(session.assistantTurns[0].content).not.toMatch(/payment plan/i);
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    expect(session.assistantTurns.map((turn) => turn.content).join(' ')).toMatch(/prefer to buy in cash/i);
    expect(getDemoQuickReplies(session.state).map((reply) => reply.label)).toEqual(['Cash', 'Installments']);
    session = advanceDemoConversation(session.state, 'Installments', 'installments');
    expect(session.state.stage).toBe('follow-up');
    expect(session.assistantTurns[0].content).toMatch(/illustrative payment plans/i);
    const photoStep = advanceDemoConversation(session.state, 'Send demo photos', 'photos');
    expect(photoStep.assistantTurns[0].content).toMatch(/synthetic demo photos/i);
    expect(photoStep.assistantTurns[0].demoPhotos?.[0]).toMatchObject({ synthetic: true, src: expect.stringContaining('/images/properties/') });
  });

  it('routes confirm, explore, and no-match responses without changing the shared turn format', () => {
    let session = qualify();
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-location');
    session = advanceDemoConversation(session.state, 'Yes, continue', 'continue-price');
    session = advanceDemoConversation(session.state, 'Cash', 'cash');
    expect(session.state.stage).toBe('follow-up');
    session = advanceDemoConversation(session.state, 'Confirm interest', 'confirm');
    expect(session.state.stage).toBe('done');
    expect(session.assistantTurns[0].content).toMatch(/recorded your interest/i);
    const done = advanceDemoConversation(session.state, 'hello');
    expect(done.assistantTurns[0].content).toMatch(/new conversation/i);
  });
});
