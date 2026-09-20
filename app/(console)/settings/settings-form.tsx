"use client";

import { useActionState, useEffect, useState } from "react";
import {
  lockTerminal,
  saveSettings,
  type SettingsFormState,
} from "./actions";
import { TerminalFrame, TypeText, useGlitch } from "@/components/terminal";
import { TASK_KEYS, TASK_LABELS } from "@/lib/tasks";
import { TIMEZONES } from "@/lib/timezones";
import type { AppSettings } from "@/lib/settings";

const initialState: SettingsFormState = { status: "idle" };

export function SettingsForm({
  settings,
  models,
}: {
  settings: AppSettings;
  models: Array<{ id: number; display_name: string }>;
}) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState);
  const [crtOn, setCrtOn] = useState(settings.crt_effects);
  const { glitchClass, trigger } = useGlitch();

  useEffect(() => {
    document.documentElement.dataset.crt = crtOn ? "on" : "off";
  }, [crtOn]);

  useEffect(() => {
    if (state.status === "saved") trigger();
  }, [state, trigger]);

  return (
    <div className={`space-y-4 ${glitchClass}`}>
      <TypeText
        as="h1"
        className="crt-aberrate crt-glow text-2xl tracking-[0.2em]"
        text="SETTINGS"
      />

      <form action={formAction} className="space-y-4">
        <TerminalFrame title="IDENTITY">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs tracking-widest">
              NAME
              <input
                className="field"
                name="display_name"
                defaultValue={settings.display_name}
                required
                autoComplete="nickname"
              />
            </label>
            <label className="text-xs tracking-widest">
              TIMEZONE
              <select
                className="field"
                name="timezone"
                defaultValue={settings.timezone}
                required
              >
                {!(TIMEZONES as readonly string[]).includes(settings.timezone) ? (
                  <option value={settings.timezone}>{settings.timezone}</option>
                ) : null}
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </TerminalFrame>

        <TerminalFrame title="TASK ROUTING">
          <div className="grid gap-4">
            {TASK_KEYS.map((key) => (
              <label key={key} className="text-xs tracking-widest">
                {TASK_LABELS[key]}
                <select
                  className="field"
                  name={`task_${key}`}
                  defaultValue={settings.task_models[key] ?? "none"}
                >
                  <option value="none">UNASSIGNED</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.display_name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {models.length === 0 ? (
              <p className="text-xs text-phosphor-dim">NO ENABLED MODELS</p>
            ) : null}
          </div>
        </TerminalFrame>

        <TerminalFrame title="DISPLAY" tone="ice">
          <fieldset>
            <legend className="text-xs tracking-widest">CRT EFFECTS</legend>
            <p className="mt-1 text-[11px] text-phosphor-dim">
              SCANLINES, FLICKER, VIGNETTE, TYPE-IN. DEFAULT ON.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="crt_effects"
                checked={crtOn}
                onChange={(event) => {
                  setCrtOn(event.target.checked);
                  trigger();
                }}
                className="sr-only"
              />
              <span
                className={crtOn ? "crt-glow text-phosphor" : "text-phosphor-dim"}
                aria-hidden="true"
              >
                [{crtOn ? "ON" : "OFF"}]
              </span>
              <span>{crtOn ? "PHOSPHOR ACTIVE" : "FLAT TERMINAL"}</span>
            </label>
          </fieldset>
        </TerminalFrame>

        {state.status === "error" ? (
          <p className="text-sm text-deny" role="alert">
            ! {state.message}
          </p>
        ) : null}
        {state.status === "saved" ? (
          <p className="text-sm text-phosphor" role="status">
            {state.message}
          </p>
        ) : null}

        <button type="submit" className="term-btn" disabled={pending}>
          {pending ? "WRITING…" : "WRITE SETTINGS"}
        </button>
      </form>

      <form action={lockTerminal}>
        <button type="submit" className="term-btn term-btn-ice">
          LOCK TERMINAL
        </button>
      </form>
    </div>
  );
}
