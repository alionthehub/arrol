"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listMicInputs,
  loadMicChoice,
  saveMicChoice,
  unlockMicLabels,
  type MicChoice,
  type MicInput,
} from "@/components/hud/mic-device";

export function MicPicker() {
  const [choice, setChoice] = useState<MicChoice>(loadMicChoice);
  const [devices, setDevices] = useState<MicInput[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");
  const unlocked = useRef(false);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setStatus("denied");
      return;
    }
    try {
      let listed = await listMicInputs();
      const unlabeled =
        listed.length === 0 ||
        listed.some((device) => !device.deviceId) ||
        listed.some((device) => /^Microphone \d+$/.test(device.label));
      if (unlabeled && !unlocked.current) {
        await unlockMicLabels();
        unlocked.current = true;
        listed = await listMicInputs();
      }
      const saved = loadMicChoice();
      if (
        saved.deviceId &&
        !listed.some((device) => device.deviceId === saved.deviceId)
      ) {
        listed = [
          {
            deviceId: saved.deviceId,
            label: `${saved.label || "Saved microphone"} (unavailable)`,
          },
          ...listed,
        ];
      }
      setDevices(listed);
      setChoice(saved);
      setStatus("ok");
    } catch {
      setDevices([]);
      setStatus("denied");
    }
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void refresh();
    });
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) {
      return () => cancelAnimationFrame(raf);
    }
    media.addEventListener("devicechange", refresh);
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("devicechange", refresh);
    };
  }, [refresh]);

  const options = devices.filter((device) => device.deviceId !== "");

  return (
    <div>
      <label className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
        INPUT
        <select
          className="hud-field"
          value={choice.deviceId}
          disabled={status === "loading"}
          onChange={(event) => {
            const deviceId = event.target.value;
            const label =
              deviceId === ""
                ? "System default"
                : options.find((device) => device.deviceId === deviceId)?.label ||
                  "";
            const next = { deviceId, label };
            saveMicChoice(next);
            setChoice(next);
          }}
        >
          <option value="">System default</option>
          {options.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 font-light text-[13px] text-ink/70">
        Used when you tap the core. Saved in this browser.
      </p>
      {status === "denied" ? (
        <div className="mt-3">
          <p className="hud-mono text-[10px] tracking-widest text-stale" role="alert">
            MIC PERMISSION NEEDED TO LIST INPUTS
          </p>
          <button
            type="button"
            className="hud-btn mt-2"
            onClick={() => {
              unlocked.current = false;
              void refresh();
            }}
          >
            GRANT MIC
          </button>
        </div>
      ) : null}
      {status === "ok" && choice.deviceId ? (
        <p className="mt-2 hud-mono text-[10px] tracking-widest text-ok">
          SAVED · {choice.label || "SELECTED"}
        </p>
      ) : null}
    </div>
  );
}
