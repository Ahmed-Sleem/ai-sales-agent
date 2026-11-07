"use client";

import React from "react";
import { EgyptMapView } from "./EgyptMapView";

/** Local SVG map; no globe renderer, third-party tiles, or remote map service. */
export const DataPanel: React.FC = () => (
  <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
    <EgyptMapView />
  </div>
);
