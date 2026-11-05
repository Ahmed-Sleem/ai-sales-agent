"use client";
/** Loading screen: a rotating wireframe globe (pure CSS/SVG, no assets). */
import React from "react";

export const LoadScreen: React.FC = () => {
  return (
    <div className="load-screen" role="status" aria-live="polite" aria-label="Loading The Real Estate Agent workspace">
      <div className="load-globe" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="load-globe-svg">
          <circle cx="50" cy="50" r="46" className="lg-sphere" />
          <ellipse cx="50" cy="50" rx="46" ry="17" className="lg-line lg-lat" />
          <ellipse cx="50" cy="50" rx="46" ry="32" className="lg-line lg-lat2" />
          <g className="lg-spin">
            <ellipse cx="50" cy="50" rx="17" ry="46" className="lg-line" />
            <ellipse cx="50" cy="50" rx="32" ry="46" className="lg-line" />
            <ellipse cx="50" cy="50" rx="46" ry="46" className="lg-line" />
          </g>
        </svg>
        <div className="load-globe-glow" />
      </div>
      <div className="load-screen-title">The Real Estate Agent</div>
      <div className="load-screen-subtitle">Loading Workspace...</div>
    </div>
  );
};
