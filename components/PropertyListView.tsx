"use client";
/** Fallback visualization: fancy list of the current drill level (same drillPath,
 *  same agent state), used when the 3D globe is off (Settings > Visualization). */
import React from "react";
import { useApp } from "../context/AppContext";
import { levelItems, type PlanetItem } from "./ObsidianGraphView";
import { findCompound, fmtPrice } from "../data/hierarchy";

export const PropertyListView: React.FC = () => {
  const { drillPath, setDrillPath, activeGraphNodeIds, shortlistedIds, rejectedIds, focusedPropertyId,
    setFocusedPropertyId, setVizSelection, setVizPhase, vizColored } = useApp();
  const { items, title } = levelItems(drillPath);

  const open = (item: PlanetItem) => {
    setVizSelection({ id: item.id, name: item.name, detail: item.sub });
    if (drillPath.length < 3) { setDrillPath([...drillPath, item.id]); setVizPhase("THINKING"); }
    else { setFocusedPropertyId(item.id); setVizPhase("FOCUS"); }
  };
  const focusedUnit = drillPath.length === 3 ? findCompound(drillPath[0], drillPath[1], drillPath[2])?.units.find(u => u.id === focusedPropertyId) : undefined;

  return (
    <div className="no-scrollbar" style={{ height: "100%", overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", letterSpacing: ".01em" }}>{title}</div>
      {drillPath.length > 0 && (
        <button type="button" onClick={() => setDrillPath(drillPath.slice(0, -1))}
          style={{ alignSelf: "flex-start", padding: "5px 11px", borderRadius: 999, border: "1px solid var(--border-med)", background: "var(--color-paper)", color: "var(--text-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>← Back</button>
      )}
      {items.map(item => {
        const isWinner = shortlistedIds.includes(item.id), isActive = activeGraphNodeIds.includes(item.id),
          isGone = rejectedIds.includes(item.id), isFocused = focusedPropertyId === item.id;
        return (
          <button key={item.id} type="button" onClick={() => open(item)}
            style={{ textAlign: "left", borderRadius: 14, padding: "12px 14px", cursor: "pointer",
              background: isWinner ? "rgba(245,158,11,.14)" : "var(--glass-bg, var(--color-paper))",
              border: `1.5px solid ${isFocused ? "var(--color-accent)" : isWinner ? "#f59e0b" : isActive ? "#22c55e" : "var(--border-soft)"}`,
              boxShadow: isActive || isFocused ? "0 0 0 3px rgba(34,197,94,.18), var(--shadow-panel)" : "var(--shadow-panel)",
              opacity: isGone ? .35 : 1, backdropFilter: "blur(12px)", color: "var(--text-primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{item.name}</span>
              {isWinner && <span style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b" }}>★ SHORTLISTED</span>}
              {isActive && !isWinner && <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e" }}>● INSPECTING</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-meta)", marginTop: 3, fontWeight: 600 }}>{item.sub}</div>
          </button>
        );
      })}
      {focusedUnit && (
        <div style={{ borderRadius: 14, padding: "14px", background: "var(--glass-bg-strong, var(--color-paper))", border: "1.5px solid var(--color-accent)", color: "var(--text-primary)" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{focusedUnit.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.9 }}>
            💰 {fmtPrice(focusedUnit.price)} • 🛏 {focusedUnit.beds} beds • 📐 {focusedUnit.bua} m²{focusedUnit.land ? ` • 🌳 ${focusedUnit.land} m² land` : ""}<br />
            ✨ {focusedUnit.finishing} • 📅 Delivery {focusedUnit.delivery}
          </div>
        </div>
      )}
      {!vizColored && <div style={{ fontSize: 10.5, color: "var(--text-meta)" }}>List view — switch back to Planet in Settings → Visualization.</div>}
    </div>
  );
};
