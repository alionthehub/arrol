"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HudTelemetry = {
  stateLabel: string;
  tokens: number;
  latencyMs: number | null;
  spendToday: string;
  spendMonth: string;
  requests: number;
  errors: number;
  io: number;
};

const DEFAULTS: HudTelemetry = {
  stateLabel: "IDLE",
  tokens: 0,
  latencyMs: null,
  spendToday: "£0.00",
  spendMonth: "£0.00",
  requests: 0,
  errors: 0,
  io: 8,
};

type Ctx = {
  tel: HudTelemetry;
  setTel: (patch: Partial<HudTelemetry>) => void;
};

const HudTelemetryContext = createContext<Ctx | null>(null);

export function HudTelemetryProvider({ children }: { children: ReactNode }) {
  const [tel, setTelState] = useState(DEFAULTS);
  const value = useMemo<Ctx>(
    () => ({
      tel,
      setTel: (patch) => setTelState((current) => ({ ...current, ...patch })),
    }),
    [tel],
  );
  return (
    <HudTelemetryContext.Provider value={value}>
      {children}
    </HudTelemetryContext.Provider>
  );
}

export function useHudTelemetry() {
  const ctx = useContext(HudTelemetryContext);
  if (!ctx) {
    throw new Error("useHudTelemetry must be used within HudTelemetryProvider");
  }
  return ctx;
}
