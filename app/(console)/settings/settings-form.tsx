"use client";

import { useActionState, useEffect, useState } from "react";
import {
  lockTerminal,
  saveSettings,
  type SettingsFormState,
} from "./actions";
import { HudFrame } from "@/components/hud/chrome";
import { MicPicker } from "@/components/hud/mic-picker";
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
  const [fxOn, setFxOn] = useState(settings.crt_effects);

  useEffect(() => {
    document.documentElement.dataset.fx = fxOn ? "on" : "off";
    document.documentElement.dataset.crt = fxOn ? "on" : "off";
  }, [fxOn]);

  return (
    <div className="space-y-4">
      <h1 className="hud-mono text-xl tracking-[0.28em] text-cyan">CFG</h1>

      <form action={formAction} className="space-y-4">
        <HudFrame title="IDENTITY">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
              NAME
              <input
                className="hud-field"
                name="display_name"
                defaultValue={settings.display_name}
                required
                autoComplete="nickname"
              />
            </label>
            <label className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
              TIMEZONE
              <select
                className="hud-field"
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
        </HudFrame>

        <HudFrame title="MICROPHONE">
          <MicPicker />
        </HudFrame>

        <HudFrame title="TASK ROUTING">
          <div className="grid gap-4">
            {TASK_KEYS.map((key) => (
              <label
                key={key}
                className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70"
              >
                {TASK_LABELS[key]}
                <select
                  className="hud-field"
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
              <p className="hud-mono text-[10px] tracking-widest text-cyan/45">
                NO ENABLED MODELS
              </p>
            ) : null}
          </div>
        </HudFrame>

        <HudFrame title="DISPLAY">
          <fieldset>
            <legend className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
              HUD EFFECTS
            </legend>
            <p className="mt-1 font-light text-[13px] text-ink/70">
              Hex mesh, scanlines, vignette, ring motion. Default on.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="crt_effects"
                checked={fxOn}
                onChange={(event) => setFxOn(event.target.checked)}
                className="hud-check"
              />
              <span className="hud-mono text-[11px] tracking-[0.2em] text-cyan">
                {fxOn ? "ATMOSPHERE ON" : "ATMOSPHERE OFF"}
              </span>
            </label>
          </fieldset>
        </HudFrame>

        {state.status === "error" ? (
          <p className="hud-mono text-sm text-stale" role="alert">
            ! {state.message}
          </p>
        ) : null}
        {state.status === "saved" ? (
          <p className="hud-mono text-sm text-ok" role="status">
            {state.message}
          </p>
        ) : null}

        <button type="submit" className="hud-btn" disabled={pending}>
          {pending ? "WRITING…" : "WRITE SETTINGS"}
        </button>
      </form>

      <form action={lockTerminal}>
        <button type="submit" className="hud-btn">
          LOCK CONSOLE
        </button>
      </form>
    </div>
  );
}
