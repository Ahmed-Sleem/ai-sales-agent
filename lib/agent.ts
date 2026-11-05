/** Free-agent loop: model calls real catalogue tools (OpenAI-compatible
 *  function calling: DeepSeek / OpenAI / Groq), code executes them locally,
 *  every tool call drives the real visualization + a real status line.
 *  Cycles (Settings) = max tool rounds. */
import { TOOL_DEFS, executeTool, type VizDirective } from "./agentTools";
import { AGENT_SYSTEM_PROMPT, AGENT_FINAL_INSTRUCTION } from "./agentPrompt";

export interface AgentCreds { key: string; provider: string; model: string; }
export interface AgentEvents {
  onStatus: (status: string) => void;
  onViz: (viz: VizDirective) => void;
  onToken?: (full: string) => void;
}
const BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function runAgent(opts: {
  creds: AgentCreds; message: string; history: { role: string; content: string }[];
  maxCycles: number; vizSelection?: { name: string; detail: string } | null; events: AgentEvents;
}): Promise<string> {
  const { creds, events } = opts;
  const base = BASE_URLS[creds.provider] || BASE_URLS.deepseek;
  const messages: any[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    ...opts.history.slice(-6),
  ];
  if (opts.vizSelection) messages.push({ role: "system", content: `The user has selected on the map: ${opts.vizSelection.name} (${opts.vizSelection.detail}). Treat it as the current focus unless they ask for something else.` });
  messages.push({ role: "user", content: opts.message });

  const callModel = async (withTools: boolean) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.key}` },
      body: JSON.stringify({ model: creds.model, messages, temperature: 0.3, ...(withTools ? { tools: TOOL_DEFS, tool_choice: "auto" } : {}) }),
    });
    if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(`Provider error ${res.status}: ${txt.slice(0, 240)}`); }
    return res.json();
  };

  const maxCycles = Math.max(1, Math.min(opts.maxCycles || 3, 6));
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    events.onStatus(`Cycle ${cycle}/${maxCycles}: agent is thinking…`);
    const data = await callModel(true);
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error("Empty response from provider.");
    const toolCalls = msg.tool_calls || [];
    if (!toolCalls.length) {
      const text = (msg.content || "").trim();
      if (text) { events.onToken?.(text); return text; }
      break;
    }
    messages.push(msg);
    for (const call of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* validated inside tools */ }
      events.onStatus(`Cycle ${cycle}/${maxCycles}: using ${call.function?.name}…`);
      await sleep(650); // let the inspection animation be seen (it reflects this exact tool call)
      const outcome = executeTool(call.function?.name || "", args);
      events.onStatus(`Cycle ${cycle}/${maxCycles}: ${outcome.status}`);
      if (outcome.viz) events.onViz(outcome.viz);
      await sleep(650);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result) });
    }
  }
  // Cycles exhausted -> one tool-free synthesis call grounded in tool results.
  events.onStatus("Synthesizing final answer…");
  messages.push({ role: "system", content: AGENT_FINAL_INSTRUCTION });
  const data = await callModel(false);
  const text = (data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("The model returned an empty final answer.");
  events.onToken?.(text);
  return text;
}
