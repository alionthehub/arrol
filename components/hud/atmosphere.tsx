"use client";

export function HudAtmosphere() {
  return (
    <div className="hud-atmosphere" aria-hidden="true">
      <div className="hud-wash" />
      <div className="hud-hex" />
      <div className="hud-scan" />
      <div className="hud-vignette" />
    </div>
  );
}
