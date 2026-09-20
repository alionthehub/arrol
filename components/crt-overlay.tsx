"use client";

export function CrtOverlay() {
  return (
    <div className="crt-fx pointer-events-none fixed inset-0" aria-hidden="true">
      <div className="crt-scanlines absolute inset-0" />
      <div className="crt-vignette absolute inset-0" />
    </div>
  );
}
