import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAgent } from '../../lib/agent';

afterEach(() => vi.unstubAllGlobals());

describe('agent map context and visualization events', () => {
  it('sends a map selection as part of the user message content', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.messages.at(-1)).toMatchObject({
        role: 'user',
        content: expect.stringContaining('Map selection attached to this user message: Cairo (city; id=city:cairo; level=city; latitude=30.04; longitude=31.23)'),
      });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Here is the area summary.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const answer = await runAgent({
      creds: { key: 'test-only', provider: 'deepseek', model: 'deepseek-chat' },
      message: 'Tell me about this place',
      history: [],
      maxCycles: 1,
      mapSelection: {
        id: 'city:cairo', name: 'Cairo', detail: 'city', level: 'city',
        coordinates: { latitude: 30.04, longitude: 31.23 },
      },
      events: {},
    });

    expect(answer).toBe('Here is the area summary.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('publishes model tool visualization directives for the map panel', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { tool_calls: [{ id: 'call-list-level', function: { name: 'list_level', arguments: '{"path":[]}' } }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'The catalogue has several areas.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const onViz = vi.fn();

    const answer = await runAgent({
      creds: { key: 'test-only', provider: 'deepseek', model: 'deepseek-chat' },
      message: 'Show me Egyptian markets', history: [], maxCycles: 2, events: { onViz },
    });

    expect(answer).toBe('The catalogue has several areas.');
    expect(onViz).toHaveBeenCalledWith(expect.objectContaining({ drillPath: [], inspectIds: expect.arrayContaining(['cairo', 'alexandria']) }));
  });
});
