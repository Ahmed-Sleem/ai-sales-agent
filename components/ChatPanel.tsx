"use client";

/**
 * WHY: Chat Workspace Panel (`ChatPanel.tsx`) — exact DOM structure from `index (31).html`.
 * Per Ahmed's exact instructions (`GAP-GPR-22`):
 * 1. Decodes live JSON tokens (`data: {"token": "..."}`) to guarantee zero truncation and zero connected characters.
 * 2. Displays a visible **Cycle Reasoning Log Card (`[ 🔄 TOC Navigation Steps ]`)** right inside the streaming bubble.
 */
import React, { useState, useRef, useEffect } from "react";
import { useApp, ConversationTurn } from "../context/AppContext";
import { runAgent } from "../lib/agent";
import { TREE, cityById } from "../data/hierarchy";

interface ExtendedTurn extends ConversationTurn {
  cycle_logs?: string[];
}

export const ChatPanel: React.FC = () => {
  const {
    conversations, activeConversationId, addTurnToConversation,
    savedApiKeys, activeApiKeyId, apiProvider, apiModel, language, setActiveGraphNodeIds, deviceId, workflowCycles, setIsSettingsOpen, t, setVizPhase, setShortlistedIds, setRejectedIds, setFocusedPropertyId, drillPath, setDrillPath, vizSelection, setVizSelection, getActiveAgentKey, showThinkingLog
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeSearchStatus, setActiveSearchStatus] = useState<string | null>(null);
  const [cycleLogs, setCycleLogs] = useState<string[]>([]);
  const [copyConvSuccess, setCopyConvSuccess] = useState(false);
  const [showCopyBtn, setShowCopyBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const turns = activeConv ? (activeConv.turns as ExtendedTurn[]) : [];

  const scheduleStreamingPaint = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setStreamingContent(streamingContentRef.current);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (turns.length > 0) setShowCopyBtn(true);
  };

  useEffect(() => {
    scrollToBottom();
  }, [turns, streamingContent, activeSearchStatus, cycleLogs]);

  useEffect(() => {
    if (showCopyBtn && !copyConvSuccess) {
      const timer = setTimeout(() => setShowCopyBtn(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showCopyBtn, copyConvSuccess]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottom && turns.length > 0) {
      setShowCopyBtn(true);
    }
  };


  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const [demoRunning, setDemoRunning] = useState(false);
  const runDemoConversation = async () => {
    if (demoRunning) return; setDemoRunning(true);
    const say = (role: "user" | "assistant", content: string, logs?: string[]) =>
      addTurnToConversation({ id: `demo_${Date.now()}_${Math.random()}`, role, content, timestamp: new Date().toISOString(), cycle_logs: logs } as any);
    try {
      setDrillPath([]); setVizPhase("IDLE"); setRejectedIds([]); setShortlistedIds([]); setFocusedPropertyId(null); setActiveGraphNodeIds([]);
      say("user", "Hi, I'm looking for a home for my family in Egypt. Where should we start?");
      await sleep(700); setVizPhase("THINKING");
      for (const c of TREE) { setActiveGraphNodeIds([c.id]); await sleep(300); }
      setActiveGraphNodeIds([]);
      say("assistant", "Hi, I’m Sara. Which area in Egypt are you interested in?");
      await sleep(600);
      say("user", "Cairo, preferably New Cairo.");
      await sleep(500); setVizPhase("THINKING"); setDrillPath(["cairo"]); await sleep(900);
      setActiveGraphNodeIds(["new-cairo"]); await sleep(400); setDrillPath(["cairo", "new-cairo"]); setActiveGraphNodeIds([]); await sleep(500);
      say("assistant", "New Cairo, got it. What budget range works for you?");
      await sleep(450);
      say("user", "Around 8.5 million EGP.");
      await sleep(450);
      say("assistant", "And what interior area would you prefer?");
      await sleep(450);
      say("user", "About 160 square metres.");
      await sleep(500); setVizPhase("NARROWING");
      say("assistant", "I found one closest synthetic match: Apartment 02 in New Cairo. Would you like me to share the price?");
      await sleep(450);
      say("user", "Yes, please.");
      say("assistant", "The illustrative demo price is 8.45 million EGP. Would you like its area next?");
      await sleep(450);
      say("user", "Yes.");
      say("assistant", "It is 165 m². Would you like the bedroom count?");
      await sleep(450);
      say("user", "Yes.");
      say("assistant", "It has three bedrooms. Would you prefer cash or an installment plan?");
      await sleep(450);
      say("user", "An installment plan.");
      say("assistant", "Illustrative plan: 15% down, over 8 years. Would you like to explore another option or confirm this one?");
      await sleep(600); setDrillPath(["cairo", "new-cairo", "sample-east-01"]); setVizPhase("THINKING"); await sleep(700);
      setVizPhase("SHORTLIST"); setShortlistedIds(["demo-cairo-apartment-02"]); setActiveGraphNodeIds(["demo-cairo-apartment-02"]); setFocusedPropertyId("demo-cairo-apartment-02");
    } finally { setDemoRunning(false); }
  };
  const resetDemo = () => { setDrillPath([]); setVizPhase("IDLE"); setRejectedIds([]); setShortlistedIds([]); setFocusedPropertyId(null); setActiveGraphNodeIds([]); };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStreaming) {
      abortControllerRef.current?.abort();
      return;
    }
    if (!inputMessage.trim()) return;

    const activeProfileId = activeApiKeyId || (savedApiKeys && savedApiKeys.length > 0 ? savedApiKeys[0].id : null);
    if (!activeProfileId) {
      alert(language === "ar"
        ? "يرجى إضافة وتفعيل ملف مفتاح API مشفر أولاً من الإعدادات قبل إرسال الرسالة."
        : "Please add and activate an encrypted API key profile from Settings before sending a message."
      );
      setIsSettingsOpen(true);
      return;
    }

    const userText = inputMessage.trim();
    setInputMessage("");

    const userTurn: ConversationTurn = {
      id: `turn_u_${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date().toISOString()
    };
    addTurnToConversation(userTurn);

    setIsStreaming(true);
    streamingContentRef.current = "";
    setStreamingContent("");
    setCycleLogs([]);
    setActiveSearchStatus(language === "ar" ? "🔍 جاري تحليل السؤال ومراجعة الفهرس..." : "🔍 Analyzing query and examining TOC...");

    const accumulatedLogs: string[] = [];

    try {
      const creds = getActiveAgentKey();
      if (!creds) throw new Error(language === "ar" ? "لم يتم العثور على مفتاح API نشط في هذا المتصفح. أضف مفتاحاً من الإعدادات." : "No active API key found in this browser. Add one in Settings (API tab).");
      if (creds.provider === "gemini") throw new Error("Gemini tool-calling is not wired yet — please use a DeepSeek / OpenAI / Groq profile for the agent.");
      let partialText = "";
      const answer = await runAgent({
        creds,
        message: userText,
        history: turns.slice(-6).map(turnItem => ({ role: turnItem.role, content: turnItem.content })),
        maxCycles: workflowCycles || 3,
        vizSelection: vizSelection ? { name: vizSelection.name, detail: vizSelection.detail } : null,
        events: {
          onStatus: (status) => { setActiveSearchStatus(status); accumulatedLogs.push(status); setCycleLogs([...accumulatedLogs]); },
          onViz: (viz) => {
            if (viz.drillPath) setDrillPath(viz.drillPath);
            if (viz.inspectIds) { setVizPhase("THINKING"); setActiveGraphNodeIds(viz.inspectIds); }
            if (viz.shortlistIds) { setVizPhase("SHORTLIST"); setShortlistedIds(viz.shortlistIds); setActiveGraphNodeIds(viz.shortlistIds); }
            if (viz.rejectedIds) setRejectedIds(viz.rejectedIds);
            if (viz.focusId) { setFocusedPropertyId(viz.focusId); setVizPhase("FOCUS"); }
          },
          onToken: (full) => { partialText = full; streamingContentRef.current = full; scheduleStreamingPaint(); },
        },
      });
      partialText = answer;
      const assistantTurn: ExtendedTurn = {
        id: `turn_a_${Date.now()}`,
        role: "assistant",
        content: partialText || (language === "ar" ? "تم استكمال البحث." : "Search completed."),
        timestamp: new Date().toISOString(),
        cycle_logs: accumulatedLogs
      };
      addTurnToConversation(assistantTurn);
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      const errTurn: ExtendedTurn = {
        id: `turn_err_${Date.now()}`,
        role: "assistant",
        content: isAbort
          ? (language === "ar" ? "تم إيقاف توليد الإجابة." : "Response generation stopped.")
          : (language === "ar" ? `عذراً، حدث خطأ في الاتصال بخادم الاسترجاع: ${e.message}` : `Sorry, error connecting to retrieval backend: ${e.message}`),
        timestamp: new Date().toISOString()
      };
      addTurnToConversation(errTurn);
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent("");
      setActiveSearchStatus(null);
      setCycleLogs([]);
    }
  };

  const decodeTextEntities = (text: string) => {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  };

  const renderCitationButton = (code: string, title: string | undefined, key: string) => {
    const cleanTitle = (title || "").replace(/^[-:\s]+/, "").trim();
    const displayLabel = cleanTitle ? `${code} · ${cleanTitle}` : code;
    return (
      <button
        key={key}

        className="source-chip"
        type="button"
        title={cleanTitle ? `${code} — ${cleanTitle}` : (language === "ar" ? "انقر لفحص البطاقة وقراءة النص الكامل" : "Click to inspect exact source node")}
        aria-label={`Open source ${displayLabel}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "12px", height: "12px", stroke: "currentColor", fill: "none", strokeWidth: 2 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h7l3 3v13H7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 4v4h4" />
        </svg>
        <span className="source-chip-code">{code}</span>
        {cleanTitle ? <span className="source-chip-title">{cleanTitle}</span> : null}
      </button>
    );
  };

  const renderInlineMarkdownOnly = (text: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;
    let keyIdx = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) parts.push(<span key={`${keyPrefix}_t_${keyIdx++}`}>{text.slice(lastIdx, match.index)}</span>);
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(<strong key={`${keyPrefix}_b_${keyIdx++}`} style={{ fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<em key={`${keyPrefix}_i_${keyIdx++}`} style={{ fontStyle: "italic" }}>{token.slice(1, -1)}</em>);
      } else {
        parts.push(<span key={`${keyPrefix}_raw_${keyIdx++}`}>{token}</span>);
      }
      lastIdx = match.index + token.length;
    }
    if (lastIdx < text.length) parts.push(<span key={`${keyPrefix}_t_${keyIdx++}`}>{text.slice(lastIdx)}</span>);
    return parts.length > 0 ? parts : text;
  };

  const renderInlineRichText = (text: string, keyPrefix: string) => {
    const decoded = decodeTextEntities(text);
    const citationRegex = /\*{0,2}\[(?:المصدر|Source):\s*(?:القسم|Section|جدول|Table)?\s*([0-9\.\w\-]+)\s*[\-\:]?\s*([^\]]+)?\]\*{0,2}/g;
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;
    let idx = 0;
    while ((match = citationRegex.exec(decoded)) !== null) {
      if (match.index > lastIdx) {
        nodes.push(...([] as React.ReactNode[]).concat(renderInlineMarkdownOnly(decoded.slice(lastIdx, match.index), `${keyPrefix}_seg_${idx}`)));
      }
      nodes.push(renderCitationButton(match[1] || "1", match[2], `${keyPrefix}_cite_${idx++}`));
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < decoded.length) {
      nodes.push(...([] as React.ReactNode[]).concat(renderInlineMarkdownOnly(decoded.slice(lastIdx), `${keyPrefix}_tail`)));
    }
    return nodes.length > 0 ? <>{nodes}</> : decoded;
  };

  const renderMarkdownContent = (text: string) => {
    if (!text) return null;
    const lines = decodeTextEntities(text).split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listKey = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(<ul key={`ul_${listKey++}`} style={{ paddingLeft: "16px", margin: "6px 0", listStyle: "disc" }}>{listItems}</ul>);
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      if (line.startsWith("## ") || line.startsWith("# ")) {
        flushList();
        elements.push(<h2 key={`h_${i}`} style={{ fontWeight: 700, fontSize: "15px", margin: "10px 0 6px", color: "var(--text-primary)" }}>{line.replace(/^##? /, "")}</h2>);
        return;
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        listItems.push(<li key={`li_${i}`} style={{ marginBottom: "4px", fontSize: "13px", lineHeight: 1.6 }}>{renderInlineRichText(line.trim().slice(2), `li_${i}`)}</li>);
        return;
      }
      if (line.trim() === "") {
        flushList();
        elements.push(<div key={`br_${i}`} style={{ height: "6px" }} />);
        return;
      }
      flushList();
      elements.push(<p key={`p_${i}`} style={{ margin: "4px 0", fontSize: "13px", lineHeight: 1.65, color: "var(--text-body)", wordBreak: "break-word" }}>{renderInlineRichText(line, `p_${i}`)}</p>);
    });
    flushList();
    return <>{elements}</>;
  };

  const renderContentWithCitations = (content: string) => renderMarkdownContent(content);

  return (
    <div className="chat-container">
      {/* Chat Messages Feed */}
      <div className="chat-messages scrollable" id="chatMessages" role="log" aria-live="polite" aria-atomic="true" onScroll={handleScroll}>
        {turns.length === 0 && !isStreaming ? (
          <div className="message" role="article" aria-label="Welcome message" style={{ alignSelf: "center", maxWidth: "90%", margin: "auto 0" }}>
            <div className="bubble" style={{ alignItems: "center", textAlign: "center", padding: "20px" }}>

              <div className="content" style={{ background: "transparent", border: "none" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>◈</div>
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  {language === "ar" ? "وكيل العقارات الذكي" : "The Real Estate Agent"}
                </h2>
              </div>
            </div>
          </div>
        ) : null}

        {turns.map(turn => (
          <div
            key={turn.id}
            className={`message ${turn.role === "user" ? "sent" : ""}`}
            role="article"
            aria-label={turn.role === "user" ? "Message from you" : "Message from assistant"}
          >
            <div className="bubble">
              <span className="role-label">
                {turn.role === "user" ? (language === "ar" ? "أنت" : "You") : (language === "ar" ? "وكيل العقارات" : "The Real Estate Agent")}
              </span>
              <div className="content">
                {/* Render cycle logs card if saved for assistant turn and actual nodes were requested (`Point 9 & Point 10`) */}
                {showThinkingLog && turn.role === "assistant" && turn.cycle_logs && turn.cycle_logs.some(l => l.includes("Inspecting") || l.includes("Requested inspection") || l.includes("inspecting")) && (
                  <div className="thinking-log-card" style={{
                    background: "var(--color-slate)", border: "1px solid var(--border-soft)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-meta)"
                  }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{language === "ar" ? "سجل الاستقصاء والتفكير:" : "THINKING LOG:"}</span>
                    </div>
                    {turn.cycle_logs.map((logStr, lIdx) => (
                      <div key={lIdx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>•</span><span>{logStr}</span>
                      </div>
                    ))}
                  </div>
                )}

                {turn.role === "assistant" ? renderContentWithCitations(turn.content) : turn.content}
              </div>
              <span className="time">
                {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {isStreaming ? (
          <div className="message" role="article" aria-label="Message from assistant">
            <div className="bubble">
              <span className="role-label">{language === "ar" ? "وكيل العقارات" : "The Real Estate Agent"}</span>
              <div className="content">
                {/* Live status feed — only when thinking log is enabled in Settings */}
                {showThinkingLog && isStreaming && (
                  <div className="thinking-log-card" style={{
                    background: "var(--color-slate)", border: "1px solid var(--border-soft)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-meta)"
                  }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{language === "ar" ? "سجل الاستقصاء والتفكير الجاري:" : "THINKING LOG:"}</span>
                    </div>
                    {cycleLogs.length > 0 ? (
                      cycleLogs.map((logStr, lIdx) => (
                        <div key={lIdx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>•</span><span>{logStr}</span>
                        </div>
                      ))
                    ) : activeSearchStatus ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>•</span><span>{activeSearchStatus}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.7 }}>
                        <span>•</span><span>{language === "ar" ? "جارٍ معالجة الاستفسار..." : "Processing query..."}</span>
                      </div>
                    )}
                  </div>
                )}

                {showThinkingLog && activeSearchStatus && (
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-accent)", marginBottom: "6px", opacity: 0.9 }}>
                    {activeSearchStatus}
                  </div>
                )}

                {streamingContent ? (
                  renderContentWithCitations(streamingContent)
                ) : (
                  <div className="typing-indicator" role="status" aria-label="Assistant is typing">
                    <span></span><span></span><span></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Small circular copy conversation button at the end of the chat page (`Point 11 - Auto-Fade visibility`) */}
        {turns.length > 0 && (
          <div style={{
            display: "flex", justifyContent: "center", margin: "12px 0 20px 0",
            opacity: showCopyBtn || copyConvSuccess ? 1 : 0,
            pointerEvents: showCopyBtn || copyConvSuccess ? "auto" : "none",
            transition: "opacity 0.35s ease"
          }}>
            <button
              type="button"
              onClick={() => {
                const fullConversationText = turns.map(t => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n---\n\n");
                navigator.clipboard.writeText(fullConversationText);
                setCopyConvSuccess(true);
                setTimeout(() => setCopyConvSuccess(false), 2500);
              }}
              style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "var(--color-stone)", border: "1px solid var(--border-med)",
                color: copyConvSuccess ? "var(--color-accent)" : "var(--text-meta)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "var(--shadow-elevated)", transition: "all 0.2s ease"
              }}
              title={language === "ar" ? "نسخ المحادثة بأكملها (Copy entire chat)" : "Copy entire chat conversation"}
              aria-label="Copy entire conversation"
            >
              {copyConvSuccess ? (
                <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", stroke: "currentColor", fill: "none", strokeWidth: 2.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", fill: "none", strokeWidth: 2 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              )}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex", gap: "8px", padding: "10px 12px 0", marginBottom: "12px", flexWrap: "wrap" }}>
        <button type="button" onClick={runDemoConversation} disabled={demoRunning} style={{ padding: "8px 14px", borderRadius: "999px", border: "none", background: "var(--color-accent)", color: "var(--color-accent-contrast)", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>{demoRunning ? "▶ Playing…" : "▶ Play demo conversation"}</button>
        <button type="button" onClick={resetDemo} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--border-med)", background: "var(--color-paper)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>↺ Reset 3D city</button>
      </div>
      {vizSelection && (
        <div style={{ display: "flex", alignItems: "center", gap: "7px", width: "fit-content", maxWidth: "68%", margin: "12px 12px 10px", padding: "5px 8px 5px 10px", borderRadius: "999px", background: "var(--glass-bg-strong, var(--color-slate))", border: "1px solid var(--border-med)", backdropFilter: "blur(14px)", fontSize: "11px", color: "var(--text-primary)" }}>
          <span aria-hidden="true">📍</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {language === "ar" ? "المحدد من الخريطة:" : "Selected on map:"} <b>{vizSelection.name}</b> <span style={{ color: "var(--text-meta)" }}>{vizSelection.detail}</span>
          </span>
                    <button type="button" aria-label={language === "ar" ? "إلغاء التحديد" : "Unselect"} title={language === "ar" ? "إلغاء التحديد" : "Unselect — do not send this selection"}
            onClick={() => { setVizSelection(null); setFocusedPropertyId(null); }}
            style={{ marginLeft: "2px", flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "50%", border: "1px solid var(--border-med)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      )}
      {/* Chat Input Area */}
      <div className="chat-input-area" id="chatInputArea">
        <form className="composer-shell" onSubmit={(event) => { event.preventDefault(); void handleSend(); }}>
          <textarea
            ref={textareaRef}
            id="chatInput"
            className="chat-input composer-input"
            placeholder={t("ask_placeholder")}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              // Auto-grow height up to max-height
              const ta = e.target;
              ta.style.height = "auto";
              const scrollHeight = ta.scrollHeight;
              if (scrollHeight <= 120) {
                ta.style.height = `${scrollHeight}px`;
              } else {
                ta.style.height = "120px";
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
            aria-label="Type your question"
            autoComplete="off"
            rows={1}
          />
          <button
            className="send-btn composer-send"
            id="sendButton"
            disabled={!isStreaming && !inputMessage.trim()}
            aria-label={isStreaming ? "Stop generation" : "Send message"}
            title={isStreaming ? (language === "ar" ? "إيقاف التوليد" : "Stop Generation") : (language === "ar" ? "إرسال الاستفسار" : "Send Query")}
            type="submit"
          >
            {isStreaming ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
