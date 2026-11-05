"use client";

/**
 * WHY: Left Panel Sidebar (`LeftPanel.tsx`) — exact layout from `index (31).html`.
 * Renders New Chat button, Conversation search bar (`Cmd+K`), Recent conversations stack,
 * and quick query suggestions grounded in our corporate manual.
 */
import React, { useState } from "react";
import { useApp } from "../context/AppContext";

export const LeftPanel: React.FC = () => {
  const { conversations, activeConversationId, setActiveConversationId, createConversation, deleteConversation, deleteAllConversations, language, t } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [removingEmptyId, setRemovingEmptyId] = useState<string | null>(null);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="left-content">
      {/* Horizontal Row: Conversation Search Bar + New Chat [+] Button + Delete All Chats Button (`Point 4`) */}
      <div className="sidebar-control-row">
        <div className="conversation-search sidebar-search" role="search">
          <svg viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
          </svg>
          <input
            type="text"
            id="conversationSearch"
            placeholder={t("search_conversations")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search conversations"
          />
        </div>

        <button
          onClick={createConversation}
          className="tool-btn sidebar-icon-btn"
          id="newChatBtn"
          aria-label="Start a new conversation"
          title={language === "ar" ? "محادثة جديدة" : "New Chat"}
          type="button"
          style={{ justifyContent: "center" }}
        >
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </button>

        <button
          onClick={() => setConfirmDeleteAll(true)}
          className="tool-btn sidebar-icon-btn"
          id="deleteAllChatsBtn"
          aria-label="Delete all conversations"
          title={language === "ar" ? "حذف جميع المحادثات" : "Delete All Chats"}
          type="button"
          style={{
            justifyContent: "center",
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
          <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      {/* Delete All Confirmation Banner (`Point 4`) */}
      {confirmDeleteAll && (
        <div style={{
          background: "var(--color-paper)", border: "1px solid #ef4444", borderRadius: "var(--radius-sm)",
          padding: "8px 10px", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>
            {language === "ar" ? "حذف جميع المحادثات؟" : "Delete all chats?"}
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                deleteAllConversations();
                setConfirmDeleteAll(false);
              }}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
            >
              {language === "ar" ? "نعم" : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(false)}
              style={{ background: "transparent", color: "var(--text-meta)", border: "1px solid var(--border-soft)", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Recent Label */}
      <div className="chat-list-label">
        <span>{language === "ar" ? "المحادثات المفتوحة" : "Recent"}</span>
      </div>

      {/* Conversations Stack */}
      <div className="chat-list scrollable" id="chatList" role="list" aria-label="Conversation list">
        {filtered.map(conv => {
          const isSelected = conv.id === activeConversationId;
          return (
            <div
              key={conv.id}
              onClick={() => {
                if (conv.id === activeConversationId) return;
                const activeConv = conversations.find(c => c.id === activeConversationId);
                if (activeConv && activeConv.turns.length === 0) {
                  setRemovingEmptyId(activeConv.id);
                  window.setTimeout(() => {
                    setActiveConversationId(conv.id);
                    setRemovingEmptyId(null);
                    document.body.classList.remove("mobile-sidebar-open");
                  }, 220);
                  return;
                }
                setActiveConversationId(conv.id);
                document.body.classList.remove("mobile-sidebar-open");
              }}
              className={`chat-item ${isSelected ? "active" : ""} ${removingEmptyId === conv.id ? "removing-empty" : ""}`}
              role="listitem"
              tabIndex={0}
              aria-current={isSelected ? "true" : undefined}
            >
              <div className="chat-item-info">
                <span className="name">{conv.title}</span>
                <span className="meta">
                  <span>{conv.turns.length} {language === "ar" ? "رسائل" : "turns"}</span>
                  <span>{new Date(conv.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="chat-delete-btn"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-meta)",
                  cursor: "pointer",
                  padding: "4px",
                  opacity: 0.6,
                  display: "flex",
                  alignItems: "center"
                }}
                title={language === "ar" ? "حذف المحادثة" : "Delete conversation"}
              >
                <svg viewBox="0 0 24 24" style={{ width: "13px", height: "13px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
