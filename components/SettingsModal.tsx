"use client";

/**
 * WHY: Master Workspace Settings Modal (`SettingsModal.tsx`).
 * Replaces `ApiKeyModal.tsx` per Ahmed's exact requirement (`GAP-GPR-18`):
 * 1. Zero scrollbars inside the modal (`overflow: hidden; max-height: 82vh;`).
 * 2. 100% pure SVG icon action buttons (`with clear bilingual tooltips`).
 * Tabs keep API configuration separate from visualization preferences.
 */
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useApp } from "../context/AppContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    savedApiKeys, activeApiKeyId, addSavedApiKey, deleteSavedApiKey, selectSavedApiKey,
    deviceId, language, vaultError, demoMode, setDemoMode, isStaticDemo, localApiKeyDataPresent, clearLocalApiKeyData
  } = useApp();

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState<"deepseek" | "groq" | "openai" | "gemini">("deepseek");
  const [model, setModel] = useState("deepseek-chat");
  const [keyInput, setKeyInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "valid" | "error"; message: string } | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && savedApiKeys.length === 0) {
      setShowAddForm(true);
    }
  }, [isOpen, savedApiKeys.length]);

  if (!isOpen || typeof document === "undefined") return null;

  const modelsForProvider = (prov: "deepseek" | "groq" | "openai" | "gemini") => {
    if (prov === "groq") {
      return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
    } else if (prov === "deepseek") {
      return ["deepseek-chat", "deepseek-reasoner"];
    } else if (prov === "gemini") {
      return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"];
    } else {
      return ["gpt-4o", "gpt-4o-mini"];
    }
  };

  const handleProviderChange = (newProv: "deepseek" | "groq" | "openai" | "gemini") => {
    setProvider(newProv);
    const available = modelsForProvider(newProv);
    if (available.length > 0) setModel(available[0]);
  };

  const handleTestConnection = async () => {
    if (!keyInput.trim()) {
      setTestResult({
        status: "error",
        message: language === "ar" ? "الرجاء إدخال مفتاح الـ API أولاً قبل الفحص." : "Please enter an API key string before testing."
      });
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/v1/vault/check-api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-ID": deviceId
        },
        body: JSON.stringify({
          provider: provider,
          api_key: keyInput.trim(),
          model: model.trim()
        })
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("application/json")) {
        // Static hosting has no vault/test endpoint (405). The key is stored in
        // this browser and verified by the provider on your first real message.
        setTestResult({ status: "error", message: language === "ar" ? "لا يوجد خادم اختبار في الاستضافة الثابتة — احفظ المفتاح وسيتم التحقق منه مع أول رسالة." : "No test server on static hosting — save the key; the provider verifies it on your first message." });
        return;
      }
      const data = await res.json();
      setTestResult({ status: data.status || "valid", message: data.message || "Connected successfully!" });
    } catch (e: any) {
      setTestResult({ status: "error", message: `Connection failure: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    const displayLabel = label.trim() || `${provider.toUpperCase()} Profile (${model})`;
    try {
      await addSavedApiKey({
        label: displayLabel,
        provider: provider,
        model: model.trim(),
        key: keyInput.trim()
      });

      setLabel("");
      setKeyInput("");
      setTestResult(null);
      setShowAddForm(false);
    } catch (err) {
      setTestResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save encrypted vault profile."
      });
    }
  };

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0, 0, 0, 0.82)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        pointerEvents: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-paper)", border: "1px solid var(--border-med)",
          borderRadius: "var(--radius-xl)", width: "560px", maxWidth: "94vw",
          maxHeight: "82vh", overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "var(--shadow-elevated)"
        }}
      >
        {/* Settings heading and close control */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid var(--border-soft)", background: "var(--color-slate)"
        }}>
          <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>{language === "ar" ? "الإعدادات" : "Settings"}</strong>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                title={language === "ar" ? "الرجوع لقائمة المفاتيح المحفوظة" : "Back to saved API profiles"}
                style={{
                  background: "transparent", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xs)",
                  cursor: "pointer", padding: "6px", color: "var(--text-primary)", display: "flex", alignItems: "center",
                  justifyContent: "center", transition: "all 0.2s ease"
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2.2, fill: "none" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title={language === "ar" ? "إغلاق الإعدادات" : "Close Settings"}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px", color: "var(--text-meta)", display: "flex", alignItems: "center" }}
            >
              <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {isStaticDemo ? (
          <section className="static-demo-safety" aria-label={language === "ar" ? "الوضع التجريبي الثابت" : "Static demo safety"}>
            <span className="static-demo-safety-badge">{language === "ar" ? "عرض توضيحي" : "PUBLIC DEMO"}</span>
            <h3>{language === "ar" ? "هذا إصدار تجريبي ثابت" : "Static demo mode"}</h3>
            <p>{language === "ar" ? "تعمل نسخة GitHub Pages ببيانات عقارية اصطناعية فقط. لا تُدخل مفاتيح API؛ لا يوجد خادم آمن لحفظها أو تشغيل وكيل مباشر هنا." : "This GitHub Pages build uses synthetic property data only. Do not enter API keys: there is no secure backend here to store them or run a live agent."}</p>
            {localApiKeyDataPresent ? (
              <div className="static-demo-key-warning">
                <span>{language === "ar" ? "توجد مفاتيح قديمة محفوظة في تخزين هذا المتصفح من إصدار سابق." : "Older API-key data remains in this browser from a previous version."}</span>
                <button type="button" onClick={clearLocalApiKeyData}>{language === "ar" ? "مسح بيانات المفاتيح المحلية" : "Clear saved local API-key data"}</button>
              </div>
            ) : null}
          </section>
        ) : (
          <>
        <div className="settings-demo-row" role="group" aria-label={language === "ar" ? "إعداد وضع التجربة" : "Demo settings"}>
          <div className="settings-demo-copy">
            <span className="settings-demo-title">{language === "ar" ? "وضع التجربة" : "Demo mode"}</span>
            <span className="settings-demo-description">
              {language === "ar" ? "استخدم بيانات محلية توضيحية دون مفتاح API." : "Use local illustrative data; no API key required."}
            </span>
          </div>
          <button
            id="demoModeToggle"
            type="button"
            role="switch"
            aria-label={language === "ar" ? "وضع التجربة" : "Demo mode"}
            aria-checked={demoMode}
            className={`settings-demo-switch${demoMode ? " is-on" : ""}`}
            onClick={() => setDemoMode(!demoMode)}
            title={language === "ar" ? "تبديل وضع المحادثة التجريبية" : "Toggle deterministic no-key demo mode"}
          >
            <span className="settings-demo-track" aria-hidden="true"><span /></span>
            <span>{demoMode ? (language === "ar" ? "مفعّل" : "ON") : (language === "ar" ? "متوقف" : "OFF")}</span>
          </button>
        </div>

        {/* Settings body */}
        <div style={{ padding: "20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
              {/* Saved Keys Header Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-meta)" }}>
                  {language === "ar" ? `المفاتيح المحفوظة (${savedApiKeys.length})` : `Saved API Key Profiles (${savedApiKeys.length})`}
                </span>
                {!showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    title={language === "ar" ? "إضافة ملف مفتاح جديد" : "Add New API Key Profile"}
                    className="tool-btn"
                    style={{ width: "28px", height: "28px", flex: "0 0 28px" }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                  </button>
                )}
              </div>

              {vaultError && (
                <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "#ef4444", fontSize: "11px", fontWeight: 600 }}>
                  {language === "ar" ? "تعذر تهيئة خزنة المفاتيح المشفرة: " : "Encrypted vault setup issue: "}{vaultError}
                </div>
              )}

              {/* Saved Keys Stack (`Point 1 - click card like radio, Point 4 - active top #1, Point 5 - red delete confirm, Point 6 - zero emojis`) */}
              {!showAddForm && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
                  {savedApiKeys.length === 0 ? (
                    <div style={{ background: "var(--color-stone)", border: "1px dashed var(--border-med)", borderRadius: "var(--radius-md)", padding: "18px", textAlign: "center", color: "var(--text-meta)", fontSize: "12px" }}>
                      {language === "ar" ? "لا توجد مفاتيح محفوظة بعد. انقر على (+) بالأعلى لإضافة مفتاحك." : "No API key profiles saved yet. Click (+) above to add your key."}
                    </div>
                  ) : (
                    [...savedApiKeys]
                      .sort((a, b) => (a.id === activeApiKeyId ? -1 : b.id === activeApiKeyId ? 1 : 0))
                      .slice(0, 4)
                      .map(k => {
                        const isActive = activeApiKeyId === k.id;
                        const isHovered = hoveredCardId === k.id;
                        const isConfirming = confirmDeleteId === k.id;
                        const maskedKey = k.key_hint ? `••••${k.key_hint}` : "Encrypted Vault";

                        return (
                          <div
                            key={k.id}
                            onClick={() => { void selectSavedApiKey(k.id); }}
                            onMouseEnter={() => setHoveredCardId(k.id)}
                            onMouseLeave={() => setHoveredCardId(null)}
                            style={{
                              background: isActive ? "var(--color-slate-raised)" : "var(--color-stone)",
                              border: isActive ? "2px solid var(--color-accent)" : "1px solid var(--border-soft)",
                              borderRadius: "var(--radius-btn)", padding: "12px 14px",
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              cursor: "pointer",
                              transform: isHovered ? "scale(0.975)" : "scale(1)",
                              transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s, border-color 0.2s"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                              {/* Radio Button Circle (`Point 1`) */}
                              <div style={{
                                width: "18px", height: "18px", borderRadius: "50%",
                                border: isActive ? "5px solid var(--color-accent)" : "2px solid var(--border-med)",
                                background: isActive ? "var(--color-paper)" : "transparent",
                                flexShrink: 0, transition: "all 0.2s ease"
                              }} />

                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                                    {k.label}
                                  </span>
                                  {isActive && (
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", display: "flex", alignItems: "center", gap: "4px" }}>
                                      <svg viewBox="0 0 24 24" style={{ width: "12px", height: "12px", stroke: "currentColor", fill: "none", strokeWidth: 3 }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                      </svg>
                                      {language === "ar" ? "مفعل حالياً" : "Active Now"}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: "11px", color: "var(--text-meta)", fontFamily: "monospace" }}>
                                  {k.provider.toUpperCase()} • {k.model} • {maskedKey}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                              {isConfirming ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--color-paper)", padding: "4px 8px", borderRadius: "var(--radius-xs)", border: "1px solid #ef4444" }}>
                                  <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>
                                    {language === "ar" ? "تأكيد الحذف؟" : "Delete?"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { void deleteSavedApiKey(k.id); setConfirmDeleteId(null); }}
                                    style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                                  >
                                    {language === "ar" ? "نعم" : "Yes"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    style={{ background: "transparent", color: "var(--text-meta)", border: "1px solid var(--border-soft)", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                                  >
                                    {language === "ar" ? "إلغاء" : "No"}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(k.id)}
                                  title={language === "ar" ? "حذف المفتاح" : "Delete key profile"}
                                  style={{
                                    background: "transparent", border: "1px solid transparent", borderRadius: "var(--radius-xs)",
                                    color: "var(--text-meta)", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center",
                                    transition: "all 0.2s ease"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "#ef4444";
                                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "var(--text-meta)";
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.borderColor = "transparent";
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {/* Add New Key Form (`Point 3 - text model input`) */}
              {showAddForm && (
                <form onSubmit={(event) => { void handleSaveAndActivate(event); }} style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "currentColor", strokeWidth: 2.5, fill: "none" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      {language === "ar" ? "إضافة ملف مفتاح جديد" : "Add New Profile"}
                    </span>
                    {savedApiKeys.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        title={language === "ar" ? "إلغاء الإضافة" : "Cancel"}
                        style={{ background: "transparent", border: "none", color: "var(--text-meta)", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={language === "ar" ? "اسم الملف (اختياري: مثال مفتاح العمل)" : "Profile Label (Optional)"}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-xs)", background: "var(--color-stone)", border: "1px solid var(--border-soft)", outline: "none", fontSize: "12px", color: "var(--text-primary)" }}
                  />

                  <div>
                    <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: "var(--text-meta)", fontWeight: 600 }}>
                      {language === "ar" ? "المزود (Provider):" : "Provider:"}
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => handleProviderChange(e.target.value as any)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-xs)", background: "var(--color-stone)", border: "1px solid var(--border-soft)", outline: "none", fontSize: "12px", color: "var(--text-primary)" }}
                    >
                      <option value="deepseek">DeepSeek</option>
                      <option value="groq">Groq</option>
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Google Gemini</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: "var(--text-meta)", fontWeight: 600 }}>
                      {language === "ar" ? "النموذج (Model):" : "Model:"}
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={language === "ar" ? "اسم النموذج (مثال: gemini-flash-latest / deepseek-chat)" : "Model Name (e.g. gemini-flash-latest / deepseek-chat)"}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-xs)", background: "var(--color-stone)", border: "1px solid var(--border-soft)", outline: "none", fontSize: "12px", color: "var(--text-primary)" }}
                    />
                  </div>

                  <input
                    type="password"
                    placeholder="API Key (`sk-...` / `gsk_...`)"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    required
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-xs)", background: "var(--color-stone)", border: "1px solid var(--border-med)", outline: "none", fontSize: "12px", color: "var(--text-primary)", fontFamily: "monospace" }}
                  />

                  {/* SVG Action Buttons Row */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !keyInput.trim()}
                      title={language === "ar" ? "فحص واختبار الاتصال" : "Test API Connection"}
                      className="tool-btn"
                      style={{ flex: 1, width: "auto", height: "30px", justifyContent: "center", gap: "6px" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      <span>{isTesting ? "..." : (language === "ar" ? "فحص" : "Test")}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!keyInput.trim()}
                      title={language === "ar" ? "حفظ وتفعيل الملف الشخصي" : "Save & Activate Profile"}
                      className="send-btn"
                      style={{ flex: 1, width: "auto", height: "30px", justifyContent: "center", gap: "6px" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>{language === "ar" ? "حفظ" : "Save"}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div style={{ fontSize: "11px", padding: "6px 10px", borderRadius: "var(--radius-xs)", background: testResult.status === "valid" ? "rgba(34, 197, 94, 0.12)" : "rgba(255, 80, 80, 0.15)", color: testResult.status === "valid" ? "#22c55e" : "#FF5E5E" }}>
                      {testResult.status === "valid" ? (language === "ar" ? "✓ " : "✓ ") : (language === "ar" ? "✗ " : "✗ ")}{testResult.message}
                    </div>
                  )}
                </form>
              )}
            </div>
        </div>
          </>
        )}
      </div>
    </div>,
    document.body
  ) as unknown as React.ReactElement;
};
