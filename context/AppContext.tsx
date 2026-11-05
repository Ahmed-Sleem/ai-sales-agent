"use client";

/**
 * WHY: Master Global Workspace State (`AppContext.tsx`).
 * Manages no-login device memory, encrypted server-side API-key vault metadata,
 * persistent per-device conversations, UI language/theme, graph state, and global modals.
 */
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { GlobalModals } from "../components/GlobalModals";

export interface DocumentDTO {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  toc_tree: any[];
  created_at: string;
  chunk_count: number;
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: { code: string; title: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  turns: ConversationTurn[];
  created_at: string;
}

export interface SavedApiKey {
  id: string;
  label: string;
  provider: "deepseek" | "groq" | "openai" | "gemini";
  model: string;
  key_hint?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
}

export interface NewApiKeyProfile {
  label: string;
  provider: "deepseek" | "groq" | "openai" | "gemini";
  model: string;
  key: string;
}

interface AppContextType {
  deviceId: string;
  language: "ar" | "en";
  setLanguage: (lang: "ar" | "en") => void;
  apiProvider: "deepseek" | "groq" | "openai" | "gemini";
  setApiProvider: (provider: "deepseek" | "groq" | "openai" | "gemini") => void;
  apiModel: string;
  setApiModel: (model: string) => void;
  workflowCycles: number;
  setWorkflowCycles: (cycles: number) => void;
  savedApiKeys: SavedApiKey[];
  activeApiKeyId: string | null;
  refreshVaultProfiles: () => Promise<void>;
  addSavedApiKey: (keyObj: NewApiKeyProfile) => Promise<void>;
  deleteSavedApiKey: (id: string) => Promise<void>;
  selectSavedApiKey: (id: string) => Promise<void>;
  vaultError: string | null;
  getActiveAgentKey: () => { key: string; provider: string; model: string } | null;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  activeGraphNodeIds: string[];
  setActiveGraphNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  vizPhase: string;
  setVizPhase: React.Dispatch<React.SetStateAction<string>>;
  shortlistedIds: string[];
  setShortlistedIds: React.Dispatch<React.SetStateAction<string[]>>;
  rejectedIds: string[];
  setRejectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  focusedPropertyId: string | null;
  setFocusedPropertyId: React.Dispatch<React.SetStateAction<string | null>>;
  drillPath: string[];
  setDrillPath: React.Dispatch<React.SetStateAction<string[]>>;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  vizColored: boolean;
  setVizColored: React.Dispatch<React.SetStateAction<boolean>>;
  vizTransparency: number;
  vizViewMode: "planet" | "list";
  showThinkingLog: boolean;
  setShowThinkingLog: React.Dispatch<React.SetStateAction<boolean>>;
  setVizViewMode: React.Dispatch<React.SetStateAction<"planet" | "list">>;
  setVizTransparency: React.Dispatch<React.SetStateAction<number>>;
  vizSelection: { id: string; name: string; detail: string } | null;
  setVizSelection: React.Dispatch<React.SetStateAction<{ id: string; name: string; detail: string } | null>>;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: () => void;
  addTurnToConversation: (turn: ConversationTurn) => void;
  deleteConversation: (id: string) => void;
  deleteAllConversations: () => void;
  isReady: boolean;
  t: (key: string) => string;
}

const translations: Record<string, Record<"ar" | "en", string>> = {
  app_title: { ar: "GPR — المساعد الداخلي الذكي للموظفين", en: "GPR — General Purpose RAG Workspace" },
  new_chat: { ar: "محادثة جديدة", en: "New Chat" },
  search_conversations: { ar: "search chats..", en: "search chats.." },
  add_api_key: { ar: "إدارة مفاتيح API ونماذج الذكاء", en: "Multi-API Key & Model Manager" },
  files_tab: { ar: "📁 المستندات والمعرفة", en: "📁 Documents" },
  graph_tab: { ar: "🕸️ الخريطة (Map)", en: "🕸️ Map" },
  ask_placeholder: { ar: "اسأل عن الكمبوندات والوحدات والأسعار...", en: "Ask about compounds, units, prices..." },
  save: { ar: "حفظ وتفعيل", en: "Save & Activate" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  api_key_placeholder: { ar: "أدخل مفتاح DeepSeek أو Groq أو OpenAI أو Google Gemini (sk-... / gsk_... / AIza...)", en: "Enter DeepSeek, Groq, OpenAI, or Google Gemini API Key (sk-... / gsk_... / AIza...)" },
  api_key_desc: { ar: "يتم حفظ المفاتيح مشفرة على الخادم ومربوطة بهذا الجهاز بدون تسجيل دخول.", en: "Key profiles are encrypted server-side and bound to this no-login device." },
  select_doc_hint: { ar: "انقر لتحديد النطاق:", en: "Click to scope chat:" },
  no_docs: { ar: "لا توجد مستندات مؤسسية مفهرسة حتى الآن.", en: "No official workspace documents indexed yet." },
  ready: { ar: "جاهز ومفهرس", en: "Ready & Indexed" },
  processing: { ar: "جاري الفهرسة...", en: "Processing..." },
  inspecting_chunks: { ar: "جاري استرجاع وفحص المقاطع في الخريطة...", en: "Inspecting chunks on graph view..." }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const isProvider = (value: unknown): value is "deepseek" | "groq" | "openai" | "gemini" =>
  value === "deepseek" || value === "groq" || value === "openai" || value === "gemini";

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deviceId, setDeviceId] = useState<string>("dev_default");
  const [isReady, setIsReady] = useState<boolean>(false);
  const [language, setLanguageState] = useState<"ar" | "en">("en");
  const [apiProvider, setApiProviderState] = useState<"deepseek" | "groq" | "openai" | "gemini">("deepseek");
  const [apiModel, setApiModelState] = useState<string>("deepseek-chat");
  const [workflowCycles, setWorkflowCyclesState] = useState<number>(3);
  const [savedApiKeys, setSavedApiKeys] = useState<SavedApiKey[]>([]);
  const [activeApiKeyId, setActiveApiKeyId] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeGraphNodeIds, setActiveGraphNodeIds] = useState<string[]>([]);
  const [vizPhase, setVizPhase] = useState<string>("IDLE");
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [focusedPropertyId, setFocusedPropertyId] = useState<string | null>(null);
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [vizColored, setVizColored] = useState<boolean>(false); // skeleton (white) by default
  const [vizTransparency, setVizTransparency] = useState<number>(68); // % transparent in skeleton mode (futuristic default)
  const [vizViewMode, setVizViewMode] = useState<"planet" | "list">("planet"); // fallback list view closes the globe
  const [showThinkingLog, setShowThinkingLog] = useState<boolean>(false); // thinking log hidden by default
  const [vizSelection, setVizSelection] = useState<{ id: string; name: string; detail: string } | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "default_conv",
      title: "New Grounded Query",
      created_at: new Date().toISOString(),
      turns: []
    }
  ]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>("default_conv");

  const hasLoadedFromStorage = useRef<boolean>(false);

  const applyActiveProfileMetadata = (profiles: SavedApiKey[], activeId: string | null) => {
    const activeProfile = profiles.find(profile => profile.id === activeId) || profiles.find(profile => profile.is_active) || profiles[0];
    if (activeProfile) {
      setActiveApiKeyId(activeProfile.id);
      setApiProviderState(activeProfile.provider);
      setApiModelState(activeProfile.model);
    } else {
      setActiveApiKeyId(null);
    }
  };


  // ---- Local vault (static hosting, e.g. GitHub Pages): no backend exists, so
  // profiles live in this browser only. Activated when the vault API is absent
  // (405/404 HTML from a static host) instead of surfacing that HTML as an error.
  const localVaultRef = useRef<boolean>(false);
  type LocalProfile = SavedApiKey & { key: string };
  const LOCAL_VAULT_KEY = "rea_local_vault_profiles_v1";
  const loadLocalProfiles = (): LocalProfile[] => {
    try { const raw = localStorage.getItem(LOCAL_VAULT_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
  };
  const saveLocalProfiles = (profiles: LocalProfile[]) => localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(profiles));
  const applyLocalProfiles = () => {
    const profiles = loadLocalProfiles();
    setSavedApiKeys(profiles.map(({ key, ...rest }) => ({ ...rest, key_hint: key ? key.slice(-4) : undefined })));
    const active = profiles.find(p => p.is_active) || profiles[0];
    applyActiveProfileMetadata(profiles, active ? active.id : null);
  };
  const seedLocalProfilesFromLegacy = () => {
    if (loadLocalProfiles().length) return;
    const legacy: LocalProfile[] = [];
    const collect = (jsonText: string | null) => { if (!jsonText) return; try { const arr = JSON.parse(jsonText); if (!Array.isArray(arr)) return; arr.forEach((item: any, i: number) => { if (item?.key) legacy.push({ id: item.id || `local_${i}`, label: item.label || "Local Profile", provider: isProvider(item.provider) ? item.provider : "deepseek", model: item.model || "deepseek-chat", key: item.key, is_active: !!item.is_active }); }); } catch { /* ignore */ } };
    collect(localStorage.getItem(`gpr_saved_keys_${deviceId}`)); collect(localStorage.getItem("gpr_saved_keys"));
    const single = localStorage.getItem("gpr_llm_api_key"); if (single) legacy.push({ id: "local_single", label: "Local Profile", provider: isProvider(localStorage.getItem("gpr_llm_provider")) ? (localStorage.getItem("gpr_llm_provider") as any) : "deepseek", model: localStorage.getItem("gpr_llm_model") || "deepseek-chat", key: single, is_active: true });
    if (legacy.length) { if (!legacy.some(p => p.is_active)) legacy[0].is_active = true; saveLocalProfiles(legacy); }
  };

  const getActiveAgentKey = (): { key: string; provider: string; model: string } | null => {
    // Static hosting: read the active profile (incl. key) from the browser-local vault.
    try {
      const profiles = loadLocalProfiles();
      const active = profiles.find(p => p.is_active) || profiles[0];
      if (active?.key) return { key: active.key, provider: active.provider, model: active.model };
    } catch { /* fall through */ }
    return null;
  };

  const refreshVaultProfiles = async () => {
    if (localVaultRef.current) { applyLocalProfiles(); return; }
    const res = await fetch("/api/v1/vault/profiles", { credentials: "include" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to load encrypted vault profiles.");
    }
    const profiles = await res.json() as SavedApiKey[];
    setSavedApiKeys(profiles);
    const active = profiles.find(profile => profile.is_active) || profiles[0];
    applyActiveProfileMetadata(profiles, active ? active.id : null);
  };

  const migrateLegacyKeysToVault = async (devId: string) => {
    const migrationFlag = localStorage.getItem(`gpr_vault_migrated_v1_${devId}`);
    const legacyProfiles: Array<NewApiKeyProfile & { legacyId?: string }> = [];

    const collectFromJson = (jsonText: string | null) => {
      if (!jsonText) return;
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((item) => {
          if (!item || typeof item.key !== "string" || !item.key.trim()) return;
          const provider = isProvider(item.provider) ? item.provider : "deepseek";
          legacyProfiles.push({
            legacyId: typeof item.id === "string" ? item.id : undefined,
            label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : `${provider.toUpperCase()} Profile`,
            provider,
            model: typeof item.model === "string" && item.model.trim() ? item.model.trim() : "deepseek-chat",
            key: item.key.trim()
          });
        });
      } catch {
        // Legacy migration is best-effort; if JSON is corrupt, keep legacy values for manual retry.
      }
    };

    collectFromJson(localStorage.getItem(`gpr_saved_keys_${devId}`));
    collectFromJson(localStorage.getItem("gpr_saved_keys"));

    const legacySingleKey = localStorage.getItem("gpr_llm_api_key") || "";
    if (legacySingleKey.trim()) {
      const legacyProvider = localStorage.getItem("gpr_llm_provider");
      const provider = isProvider(legacyProvider) ? legacyProvider : "deepseek";
      legacyProfiles.push({
        legacyId: "legacy_single_key",
        label: `${provider.toUpperCase()} Legacy Profile`,
        provider,
        model: localStorage.getItem("gpr_llm_model") || "deepseek-chat",
        key: legacySingleKey.trim()
      });
    }

    const deduped = legacyProfiles.filter((profile, index, arr) =>
      arr.findIndex(candidate => candidate.key === profile.key && candidate.provider === profile.provider && candidate.model === profile.model) === index
    );

    if (migrationFlag === "true" || deduped.length === 0) return;

    const legacyActiveId = localStorage.getItem(`gpr_active_key_id_${devId}`);
    let migratedCount = 0;
    for (const [index, profile] of deduped.entries()) {
      const activate = profile.legacyId === legacyActiveId || (!legacyActiveId && index === 0);
      const res = await fetch("/api/v1/vault/profiles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: profile.label,
          provider: profile.provider,
          model: profile.model,
          api_key: profile.key,
          activate,
          test_before_save: false
        })
      });
      if (!res.ok) {
        throw new Error("Legacy API-key migration failed before raw browser keys could be removed.");
      }
      migratedCount += 1;
    }

    if (migratedCount === deduped.length) {
      localStorage.removeItem(`gpr_saved_keys_${devId}`);
      localStorage.removeItem("gpr_saved_keys");
      localStorage.removeItem("gpr_llm_api_key");
      localStorage.removeItem("gpr_llm_provider");
      localStorage.removeItem("gpr_llm_model");
      localStorage.removeItem(`gpr_active_key_id_${devId}`);
      localStorage.setItem(`gpr_vault_migrated_v1_${devId}`, "true");
    }
  };

  const initializeVault = async (devId: string) => {
    try {
      setVaultError(null);
      const bootstrap = await fetch("/api/v1/vault/bootstrap", { method: "POST", credentials: "include" });
      const bootText = bootstrap.ok ? "" : await bootstrap.text();
      if (!bootstrap.ok) {
        // Static hosting (GitHub Pages) answers POST with 405 HTML: there is no
        // vault server by design. Fall back to the browser-local vault silently.
        if (bootstrap.status === 404 || bootstrap.status === 405 || bootText.includes("<html")) {
          localVaultRef.current = true;
          seedLocalProfilesFromLegacy();
          applyLocalProfiles();
          setVaultError(null);
          return;
        }
        throw new Error(bootText.replace(/<[^>]*>/g, " ").trim() || `Vault setup failed (${bootstrap.status})`);
      }
      await migrateLegacyKeysToVault(devId);
      await refreshVaultProfiles();
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : "Encrypted vault initialization failed.");
    }
  };

  useEffect(() => {
    const boot = async () => {
      let devId = localStorage.getItem("gpr_device_id");
      if (!devId) {
        devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem("gpr_device_id", devId);
      }
      setDeviceId(devId);

      const savedLang = (localStorage.getItem("gpr_language") as "ar" | "en") || "en";
      const savedTheme = "dark"; // light-mode button removed: app runs dark-only
      setVizColored(localStorage.getItem("rea_viz_colored") === "true");
      const savedTransp = Number(localStorage.getItem("rea_viz_transparency"));
      if (Number.isFinite(savedTransp) && savedTransp >= 0 && savedTransp <= 90) setVizTransparency(savedTransp);
      if (localStorage.getItem("rea_viz_view") === "list") setVizViewMode("list");
      setShowThinkingLog(localStorage.getItem("rea_show_thinking_log") === "true");
      const savedCycles = parseInt(localStorage.getItem(`gpr_workflow_cycles_${devId}`) || "3", 10);
      setLanguageState(savedLang === "ar" || savedLang === "en" ? savedLang : "en");
      if (savedCycles >= 1 && savedCycles <= 6) setWorkflowCyclesState(savedCycles);
      document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = savedLang === "ar" ? "ar" : "en";
      setThemeState("dark");
      document.body.classList.add("dark-mode");

      const convsJson = localStorage.getItem(`gpr_conversations_${devId}`) || localStorage.getItem("gpr_conversations");
      let initialConvs: Conversation[] = [
        {
          id: "default_conv",
          title: savedLang === "ar" ? "محادثة استفسار في الدليل المؤسسي" : "New Grounded Query",
          created_at: new Date().toISOString(),
          turns: []
        }
      ];

      if (convsJson) {
        try {
          const parsedConvs = JSON.parse(convsJson);
          if (Array.isArray(parsedConvs) && parsedConvs.length > 0) initialConvs = parsedConvs;
        } catch {
          // Keep default conversation if persisted JSON is invalid.
        }
      }

      const existingEmpty = initialConvs.find(conv => conv.turns.length === 0);
      const bootEmptyConversation: Conversation = existingEmpty || {
        id: `conv_${Date.now()}`,
        title: savedLang === "ar" ? "محادثة استفسار في الدليل المؤسسي" : "New Grounded Query",
        created_at: new Date().toISOString(),
        turns: []
      };
      const bootConversations = [
        bootEmptyConversation,
        ...initialConvs.filter(conv => conv.turns.length > 0)
      ];

      setConversations(bootConversations);
      setActiveConversationIdState(bootEmptyConversation.id);

      await initializeVault(devId);
      hasLoadedFromStorage.current = true;
      setIsReady(true);
    };
    void boot();
  }, []);

  useEffect(() => {
    if (!hasLoadedFromStorage.current || !isReady || !deviceId) return;
    localStorage.setItem(`gpr_conversations_${deviceId}`, JSON.stringify(conversations));
    localStorage.setItem("gpr_conversations", JSON.stringify(conversations));
    if (activeConversationId) {
      localStorage.setItem(`gpr_active_conv_id_${deviceId}`, activeConversationId);
      localStorage.setItem("gpr_active_conv_id", activeConversationId);
    }
  }, [conversations, activeConversationId, isReady, deviceId]);

  const setLanguage = (lang: "ar" | "en") => {
    setLanguageState(lang);
    localStorage.setItem("gpr_language", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  };


  const setTheme = (thm: "dark" | "light") => {
    setThemeState(thm);
    localStorage.setItem("gpr_theme", thm);
    if (thm === "dark") document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  };

  useEffect(() => { localStorage.setItem("rea_viz_colored", String(vizColored)); }, [vizColored]);
  useEffect(() => { localStorage.setItem("rea_viz_transparency", String(vizTransparency)); }, [vizTransparency]);
  useEffect(() => { localStorage.setItem("rea_viz_view", vizViewMode); }, [vizViewMode]);
  useEffect(() => { localStorage.setItem("rea_show_thinking_log", String(showThinkingLog)); }, [showThinkingLog]);

  const setApiProvider = (prov: "deepseek" | "groq" | "openai" | "gemini") => {
    setApiProviderState(prov);
  };

  const setApiModel = (model: string) => {
    setApiModelState(model);
  };

  const setWorkflowCycles = (cycles: number) => {
    const valid = Math.min(Math.max(cycles, 1), 6);
    setWorkflowCyclesState(valid);
    localStorage.setItem(`gpr_workflow_cycles_${deviceId}`, String(valid));
  };

  const addSavedApiKey = async (keyObj: NewApiKeyProfile) => {
    if (localVaultRef.current) {
      const profiles = loadLocalProfiles().map(p => ({ ...p, is_active: false }));
      profiles.push({ id: `local_${Date.now()}`, label: keyObj.label, provider: keyObj.provider, model: keyObj.model, key: keyObj.key, is_active: true, created_at: new Date().toISOString() });
      saveLocalProfiles(profiles); applyLocalProfiles(); return;
    }
    const res = await fetch("/api/v1/vault/profiles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: keyObj.label,
        provider: keyObj.provider,
        model: keyObj.model,
        api_key: keyObj.key,
        activate: true,
        test_before_save: false
      })
    });
    if (!res.ok) throw new Error(await res.text());
    await refreshVaultProfiles();
  };

  const deleteSavedApiKey = async (id: string) => {
    if (localVaultRef.current) { saveLocalProfiles(loadLocalProfiles().filter(p => p.id !== id)); applyLocalProfiles(); return; }
    const res = await fetch(`/api/v1/vault/profiles/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    await refreshVaultProfiles();
  };

  const selectSavedApiKey = async (id: string) => {
    if (localVaultRef.current) { saveLocalProfiles(loadLocalProfiles().map(p => ({ ...p, is_active: p.id === id }))); applyLocalProfiles(); return; }
    const res = await fetch(`/api/v1/vault/profiles/${id}/activate`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    await refreshVaultProfiles();
  };


  const setActiveConversationId = (id: string | null) => {
    if (!id) {
      setActiveConversationIdState(null);
      return;
    }
    setConversations(prev => {
      const active = prev.find(c => c.id === activeConversationId);
      if (active && active.id !== id && active.turns.length === 0) {
        return prev.filter(c => c.id !== active.id);
      }
      return prev;
    });
    setActiveConversationIdState(id);
  };

  const createConversation = () => {
    const active = conversations.find(c => c.id === activeConversationId);
    if (active && active.turns.length === 0) {
      setActiveConversationIdState(active.id);
      return;
    }

    const existingEmpty = conversations.find(c => c.turns.length === 0);
    if (existingEmpty) {
      setActiveConversationIdState(existingEmpty.id);
      return;
    }

    const newId = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: language === "ar" ? "محادثة استفسار في الدليل المؤسسي" : "New Grounded Query",
      created_at: new Date().toISOString(),
      turns: []
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationIdState(newId);
  };

  const addTurnToConversation = (turn: ConversationTurn) => {
    if (!activeConversationId) return;
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConversationId) {
          const updatedTurns = [...c.turns, turn];
          let updatedTitle = c.title;
          if (c.turns.length === 0 && turn.role === "user") updatedTitle = turn.content.slice(0, 35) + "...";
          return { ...c, turns: updatedTurns, title: updatedTitle };
        }
        return c;
      })
    );
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (updated.length === 0) {
        const defaultConv: Conversation = {
          id: `conv_${Date.now()}`,
          title: language === "ar" ? "محادثة استفسار في الدليل المؤسسي" : "New Grounded Query",
          created_at: new Date().toISOString(),
          turns: []
        };
        setActiveConversationIdState(defaultConv.id);
        return [defaultConv];
      } else if (activeConversationId === id) {
        setActiveConversationIdState(updated[0].id);
      }
      return updated;
    });
  };

  const deleteAllConversations = () => {
    const defaultConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: language === "ar" ? "محادثة استفسار في الدليل المؤسسي" : "New Grounded Query",
      created_at: new Date().toISOString(),
      turns: []
    };
    setConversations([defaultConv]);
    setActiveConversationIdState(defaultConv.id);
    localStorage.setItem(`gpr_conversations_${deviceId}`, JSON.stringify([defaultConv]));
  };

  const t = (key: string): string => translations[key]?.[language] || key;

  return (
    <AppContext.Provider
      value={{
        deviceId,
        isReady,
        language,
        setLanguage,
        apiProvider,
        setApiProvider,
        apiModel,
        setApiModel,
        workflowCycles,
        setWorkflowCycles,
        savedApiKeys,
        activeApiKeyId,
        refreshVaultProfiles,
        addSavedApiKey,
        deleteSavedApiKey,
        selectSavedApiKey,
        vaultError,
        getActiveAgentKey,
        isSettingsOpen,
        setIsSettingsOpen,
        activeGraphNodeIds,
        vizPhase, setVizPhase, shortlistedIds, setShortlistedIds, rejectedIds, setRejectedIds, focusedPropertyId, setFocusedPropertyId, drillPath, setDrillPath, theme, setTheme, vizColored, setVizColored, vizTransparency, setVizTransparency, vizViewMode, setVizViewMode, showThinkingLog, setShowThinkingLog, vizSelection, setVizSelection,
        setActiveGraphNodeIds,
        conversations,
        activeConversationId,
        setActiveConversationId,
        createConversation,
        addTurnToConversation,
        deleteConversation,
        deleteAllConversations,
        t
      }}
    >
      {children}
      <GlobalModals />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
};
