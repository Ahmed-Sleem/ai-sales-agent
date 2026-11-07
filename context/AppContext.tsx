"use client";

/**
 * WHY: Master Global Workspace State (`AppContext.tsx`).
 * Manages device-local app preferences, conversation state, optional API profiles, and global modals.
 */
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { GlobalModals } from "../components/GlobalModals";
import type { VizDirective } from "../lib/agentTools";

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

export interface MapSelection {
  id: string;
  name: string;
  detail: string;
  level?: "country" | "governorate" | "city" | "district" | "community" | "property";
  coordinates?: { latitude: number; longitude: number };
}

export interface MapDirectiveUpdate {
  revision: number;
  directive: VizDirective;
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: { code: string; title: string }[];
  demoPhotos?: { src: string; alt: string; synthetic: true }[];
  mapSelection?: MapSelection;
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
  workspaceView: "map" | "analytics";
  setWorkspaceView: React.Dispatch<React.SetStateAction<"map" | "analytics">>;
  isStaticDemo: boolean;
  localApiKeyDataPresent: boolean;
  clearLocalApiKeyData: () => void;
  demoMode: boolean;
  setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  vizSelection: MapSelection | null;
  setVizSelection: React.Dispatch<React.SetStateAction<MapSelection | null>>;
  mapDirective: MapDirectiveUpdate | null;
  publishMapDirective: (directive: VizDirective) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  startNewConversation: () => void;
  addTurnToConversation: (turn: ConversationTurn) => void;
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
  api_key_desc: { ar: "مفاتيح API غير متاحة في النسخة التجريبية الثابتة.", en: "API keys are not available in the static demo build." },
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
  const [language, setLanguageState] = useState<"ar" | "en">("ar");
  const [apiProvider, setApiProviderState] = useState<"deepseek" | "groq" | "openai" | "gemini">("deepseek");
  const [apiModel, setApiModelState] = useState<string>("deepseek-chat");
  const [savedApiKeys, setSavedApiKeys] = useState<SavedApiKey[]>([]);
  const [activeApiKeyId, setActiveApiKeyId] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [workspaceView, setWorkspaceView] = useState<"map" | "analytics">("map");
  const [isStaticDemo, setIsStaticDemo] = useState<boolean>(true);
  const [localApiKeyDataPresent, setLocalApiKeyDataPresent] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [vizSelection, setVizSelection] = useState<MapSelection | null>(null);
  const [mapDirective, setMapDirective] = useState<MapDirectiveUpdate | null>(null);
  const mapDirectiveRevision = useRef(0);
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


  // ---- Detect static hosts such as GitHub Pages. In that case API-key storage
  // is disabled: the demo stays no-key and old local profiles are only offered for explicit clearing.
  const localVaultRef = useRef<boolean>(false);
  type LocalProfile = SavedApiKey & { key: string };
  const LOCAL_VAULT_KEY = "rea_local_vault_profiles_v1";
  const localApiKeyStorageKeys = (devId = deviceId) => [
    LOCAL_VAULT_KEY,
    `gpr_saved_keys_${devId}`,
    "gpr_saved_keys",
    `gpr_active_key_id_${devId}`,
    "gpr_active_key_id",
    "gpr_llm_api_key",
    "gpr_llm_provider",
    "gpr_llm_model",
  ];
  const hasLocalApiKeyData = (devId = deviceId) => localApiKeyStorageKeys(devId).some((key) => Boolean(localStorage.getItem(key)));
  const loadLocalProfiles = (): LocalProfile[] => {
    try { const raw = localStorage.getItem(LOCAL_VAULT_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
  };
  const getActiveAgentKey = (): { key: string; provider: string; model: string } | null => {
    // Static hosting deliberately refuses browser-local API keys; the public demo is no-key only.
    if (localVaultRef.current) return null;
    try {
      const profiles = loadLocalProfiles();
      const active = profiles.find(p => p.is_active) || profiles[0];
      if (active?.key) return { key: active.key, provider: active.provider, model: active.model };
    } catch { /* fall through */ }
    return null;
  };

  const clearLocalApiKeyData = () => {
    localApiKeyStorageKeys().forEach((key) => localStorage.removeItem(key));
    setLocalApiKeyDataPresent(false);
    setSavedApiKeys([]);
    setActiveApiKeyId(null);
  };

  const refreshVaultProfiles = async () => {
    if (localVaultRef.current) { setSavedApiKeys([]); setActiveApiKeyId(null); return; }
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
        // Static hosting (GitHub Pages) answers with 404/405 HTML: there is no
        // vault server by design. Keep the no-key demo and do not load local key profiles.
        if (bootstrap.status === 404 || bootstrap.status === 405 || bootText.includes("<html")) {
          localVaultRef.current = true;
          setIsStaticDemo(true);
          setDemoMode(true);
          setSavedApiKeys([]);
          setActiveApiKeyId(null);
          setLocalApiKeyDataPresent(hasLocalApiKeyData(devId));
          setVaultError(null);
          return;
        }
        throw new Error(bootText.replace(/<[^>]*>/g, " ").trim() || `Vault setup failed (${bootstrap.status})`);
      }
      await migrateLegacyKeysToVault(devId);
      await refreshVaultProfiles();
      setIsStaticDemo(false);
      setLocalApiKeyDataPresent(false);
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

      const storedLang = localStorage.getItem("gpr_language");
      const savedLang = storedLang === "ar" || storedLang === "en" ? storedLang : "ar";
      setLanguageState(savedLang);
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

  const publishMapDirective = (directive: VizDirective) => {
    mapDirectiveRevision.current += 1;
    setMapDirective({ revision: mapDirectiveRevision.current, directive });
  };

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


  const setApiProvider = (prov: "deepseek" | "groq" | "openai" | "gemini") => {
    setApiProviderState(prov);
  };

  const setApiModel = (model: string) => {
    setApiModelState(model);
  };

  const addSavedApiKey = async (keyObj: NewApiKeyProfile) => {
    if (localVaultRef.current) throw new Error("API keys are disabled in this static demo. Use the no-key demo mode.");
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
    if (localVaultRef.current) throw new Error("There are no API key profiles in static demo mode.");
    const res = await fetch(`/api/v1/vault/profiles/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    await refreshVaultProfiles();
  };

  const selectSavedApiKey = async (id: string) => {
    if (localVaultRef.current) throw new Error("API keys are disabled in this static demo.");
    const res = await fetch(`/api/v1/vault/profiles/${id}/activate`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    await refreshVaultProfiles();
  };


  const startNewConversation = () => {
    const newId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newConv: Conversation = {
      id: newId,
      title: language === "ar" ? "بحث عقاري جديد" : "New property search",
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
        workspaceView,
        setWorkspaceView,
        isStaticDemo,
        localApiKeyDataPresent,
        clearLocalApiKeyData,
        demoMode,
        setDemoMode,
        theme, setTheme, vizSelection, setVizSelection, mapDirective, publishMapDirective,
        conversations,
        activeConversationId,
        startNewConversation,
        addTurnToConversation,
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
