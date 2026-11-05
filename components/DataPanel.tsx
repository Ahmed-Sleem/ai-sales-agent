"use client";
import React from "react";
import { useApp } from "../context/AppContext";
import { ObsidianGraphView } from "./ObsidianGraphView";
import { PropertyListView } from "./PropertyListView";

export const DataPanel: React.FC = () => {
  const { vizViewMode } = useApp();
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      {vizViewMode === "list" ? <PropertyListView /> : <ObsidianGraphView />}
    </div>
  );
};
