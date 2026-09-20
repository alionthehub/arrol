"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage, type ChatHistoryItem } from "@/app/(console)/chat/actions";
import { HudCore, type VoiceMode } from "@/components/hud/core";
import { HudPanelCard } from "@/components/hud/panel";
import { useHudTelemetry } from "@/components/hud/telemetry";
import {
  WEBM_FILENAME,
  createHudVoiceIo,
  pickWebmOpusMime,
  webmFileFromBlob,
  type HudVoiceIo,
} from "@/components/hud/voice-io";
import {
  isNearSilent,
  loadMicChoice,
  noAudioMessage,
  recordingPeak,
} from "@/components/hud/mic-device";
import { panelFromTool, type HudPanel } from "@/lib/hud-data";
import { formatClock } from "@/lib/uptime";

type LivePanel = HudPanel & { fading: boolean };

const PANEL_LIFE_MS = 60_000;
const PANEL_FADE_MS = 900;
const HISTORY_CAP = 16;

export function HudConsole({
  modelId,
  timezone,
  interactive,
}: {
  modelId: number | null;
  timezone: string;
  interactive: boolean;
}) {
  const { setTel } = useHudTelemetry();
  const [mode, setMode] = useState<VoiceMode>("idle");
  const [clock, setClock] = useState("--:--:--");
  const [finalText, setFinalText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [voiceOk, setVoiceOk] = useState(true);
  const [awaiting, setAwaiting] = useState(false);
  const [panels, setPanels] = useState<LivePanel[]>([]);
  const listening = useRef(false);
  const modeRef = useRef<VoiceMode>("idle");
  const ioRef = useRef<HudVoiceIo | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const historyRef = useRef<ChatHistoryItem[]>([]);
  const genRef = useRef(0);
  const speakAbort = useRef<AbortController | null>(null);
  const dismiss = useRef<number>(0);
  const panelTimers = useRef<Map<string, { fade: number; gone: number }>>(new Map());
  const typedRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date(), timezone));
    const raf = requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [timezone]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVoiceOk(
        typeof MediaRecorder !== "undefined" &&
          Boolean(navigator.mediaDevices?.getUserMedia) &&
          Boolean(pickWebmOpusMime()),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timers = panelTimers.current;
    return () => {
      genRef.current += 1;
      speakAbort.current?.abort();
      ioRef.current?.player.stop();
      ioRef.current?.recorder.release();
      for (const pair of timers.values()) {
        window.clearTimeout(pair.fade);
        window.clearTimeout(pair.gone);
      }
      timers.clear();
    };
  }, []);

  const ensureIo = useCallback(() => {
    if (!ioRef.current) ioRef.current = createHudVoiceIo();
    return ioRef.current;
  }, []);

  const revealPanels = useCallback((incoming: HudPanel[]) => {
    if (incoming.length === 0) return;
    setPanels((current) => {
      const next = [...current];
      for (const panel of incoming) {
        const index = next.findIndex((item) => item.id === panel.id);
        const live = { ...panel, fading: false };
        if (index >= 0) next[index] = live;
        else next.push(live);
      }
      return next;
    });
    for (const panel of incoming) {
      const prev = panelTimers.current.get(panel.id);
      if (prev) {
        window.clearTimeout(prev.fade);
        window.clearTimeout(prev.gone);
      }
      const fade = window.setTimeout(() => {
        setPanels((current) =>
          current.map((item) =>
            item.id === panel.id ? { ...item, fading: true } : item,
          ),
        );
      }, PANEL_LIFE_MS - PANEL_FADE_MS);
      const gone = window.setTimeout(() => {
        setPanels((current) => current.filter((item) => item.id !== panel.id));
        panelTimers.current.delete(panel.id);
      }, PANEL_LIFE_MS);
      panelTimers.current.set(panel.id, { fade, gone });
    }
  }, []);

  const speakReply = useCallback(
    async (text: string, token: number) => {
      const spoken = text.trim();
      if (!spoken) return;
      const io = ensureIo();
      speakAbort.current?.abort();
      const controller = new AbortController();
      speakAbort.current = controller;
      setMode("speak");
      setTel({ stateLabel: "SPEAK" });
      analyserRef.current = io.player.analyser;
      try {
        const response = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: spoken }),
          signal: controller.signal,
        });
        if (token !== genRef.current) return;
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setReply((current) => current ?? payload?.error ?? "SPEAK FAILED");
          return;
        }
        await io.player.play(response);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (token !== genRef.current) return;
        setReply((current) => current ?? "SPEAK FAILED");
      } finally {
        if (token === genRef.current) {
          analyserRef.current = null;
          setMode("idle");
        }
      }
    },
    [ensureIo, setTel],
  );

  const fire = useCallback(
    (message: string) => {
      if (!modelId) {
        setReply("NO MODEL ASSIGNED");
        setMode("idle");
        setTel({ stateLabel: "IDLE" });
        return;
      }
      const token = genRef.current;
      const history = historyRef.current.slice(-HISTORY_CAP);
      setMode("work");
      setTel({ stateLabel: "WORK" });
      window.clearTimeout(dismiss.current);

      startTransition(async () => {
        const result = await sendChatMessage({
          modelId,
          message,
          history,
        });
        if (token !== genRef.current) return;
        if (!result.ok) {
          setReply(result.error);
          setTel({ stateLabel: "FAULT" });
          setAwaiting(false);
          setMode("idle");
          return;
        }
        const answer = result.text || "ACK";
        historyRef.current = [
          ...history,
          { role: "user" as const, text: message },
          { role: "assistant" as const, text: answer },
        ].slice(-HISTORY_CAP);
        setReply(answer);
        setAwaiting(result.awaitingConfirmation);
        setTel({
          stateLabel: result.awaitingConfirmation ? "CONFIRM" : "READY",
        });
        const shown = result.toolCalls
          .filter((call) => !call.isError)
          .map((call) => panelFromTool(call.name, call.result))
          .filter((panel): panel is HudPanel => panel !== null);
        revealPanels(shown);
        await speakReply(answer, token);
        if (token !== genRef.current) return;
        if (result.awaitingConfirmation) {
          setTel({ stateLabel: "CONFIRM" });
          return;
        }
        dismiss.current = window.setTimeout(() => {
          setReply(null);
          setTel({ stateLabel: "IDLE" });
        }, 2500);
      });
    },
    [modelId, revealPanels, setTel, speakReply],
  );

  const startListen = useCallback(() => {
    if (!interactive || listening.current || modeRef.current === "work") return;
    genRef.current += 1;
    speakAbort.current?.abort();
    ioRef.current?.player.stop();
    analyserRef.current = null;
    listening.current = true;
    window.clearTimeout(dismiss.current);
    setMode("listen");
    setTel({ stateLabel: "LIVE" });
    setFinalText("");
    void (async () => {
      try {
        const io = ensureIo();
        await io.recorder.start(loadMicChoice().deviceId);
        if (!listening.current) {
          await io.recorder.stop();
          analyserRef.current = null;
          return;
        }
        // Isolation: do not tap the mic stream into the analyser while recording.
        analyserRef.current = null;
        setVoiceOk(true);
      } catch (error) {
        listening.current = false;
        analyserRef.current = null;
        setVoiceOk(false);
        setMode("idle");
        setTel({ stateLabel: "FAULT" });
        const denied =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "NotFoundError");
        setReply(
          denied
            ? "MIC DENIED"
            : error instanceof Error
              ? error.message
              : "MIC DENIED",
        );
      }
    })();
  }, [ensureIo, interactive, setTel]);

  const stopAndSend = useCallback(() => {
    if (!listening.current) return;
    listening.current = false;
    setPulse((n) => n + 1);
    const io = ioRef.current;
    if (!io) {
      setMode("idle");
      setTel({ stateLabel: "IDLE" });
      return;
    }
    void (async () => {
      let blob: Blob;
      let deviceLabel = loadMicChoice().label || "microphone";
      try {
        const recorded = await io.recorder.stop();
        blob = recorded.blob;
        deviceLabel = recorded.deviceLabel;
      } catch {
        analyserRef.current = null;
        setMode("idle");
        setTel({ stateLabel: "IDLE" });
        return;
      }
      analyserRef.current = null;
      const peak = await recordingPeak(blob);
      console.info("[arrol-voice] blob before send", {
        bytes: blob.size,
        mimeType: blob.type || "(empty)",
        peak,
        deviceLabel,
      });
      const silent = isNearSilent(blob.size, peak);
      if (silent) {
        const message = noAudioMessage(deviceLabel);
        console.info("[arrol-voice] skip: near-silent recording", {
          bytes: blob.size,
          peak,
          deviceLabel,
        });
        setReply(message);
        setMode("idle");
        setTel({ stateLabel: "FAULT" });
        return;
      }
      const token = genRef.current;
      setMode("work");
      setTel({ stateLabel: "WORK" });
      try {
        const file = webmFileFromBlob(blob);
        console.info("[arrol-voice] posting /api/transcribe", {
          name: file.name,
          bytes: file.size,
          mimeType: file.type,
        });
        const form = new FormData();
        form.append("audio", file, WEBM_FILENAME);
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        const raw = await response.text();
        console.info("[arrol-voice] transcribe response", {
          status: response.status,
          body: raw.slice(0, 2000),
        });
        let payload: { text?: string; error?: string } = {};
        try {
          payload = JSON.parse(raw) as { text?: string; error?: string };
        } catch {
          throw new Error("Transcribe returned non-JSON.");
        }
        if (token !== genRef.current) return;
        if (!response.ok || !payload.text) {
          const emptySpeech =
            !payload.text || /no speech heard/i.test(payload.error || "");
          throw new Error(
            emptySpeech ? noAudioMessage(deviceLabel) : payload.error || "TRANSCRIBE FAILED",
          );
        }
        setFinalText(payload.text);
        fire(payload.text);
      } catch (error) {
        if (token !== genRef.current) return;
        setReply(error instanceof Error ? error.message : "TRANSCRIBE FAILED");
        setMode("idle");
        setTel({ stateLabel: "FAULT" });
      }
    })();
  }, [fire, setTel]);

  const toggleListen = useCallback(() => {
    if (!interactive || modeRef.current === "work") return;
    if (listening.current || modeRef.current === "listen") {
      stopAndSend();
      return;
    }
    startListen();
  }, [interactive, startListen, stopAndSend]);

  useEffect(() => {
    if (!interactive) return;
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggleListen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, toggleListen]);

  const stateLabel =
    mode === "listen"
      ? "LIVE"
      : mode === "work"
        ? "WORKING"
        : mode === "speak"
          ? "SPEAKING"
          : awaiting
            ? "CONFIRM"
            : "";
  const transcript =
    mode === "listen"
      ? voiceOk
        ? ""
        : "MIC DENIED"
      : mode === "work"
        ? finalText
        : mode === "speak"
          ? reply || finalText
          : "";

  const left = panels.filter((panel) => panel.side === "left");
  const right = panels.filter((panel) => panel.side === "right");
  const busy = mode === "work";

  return (
    <div className="relative h-full min-h-0">
      <div className="flex h-full min-h-0 items-center justify-center px-3 py-3">
        <div className="relative aspect-square w-[min(92vw,calc(100dvh-5.5rem))]">
          <HudCore
            mode={mode}
            pulse={pulse}
            interactive={interactive}
            onToggle={toggleListen}
            stateLabel={stateLabel}
            clock={clock}
            transcript={transcript}
            arcTop=""
            arcBottom=""
            analyserRef={analyserRef}
          />
        </div>
      </div>

      {left.length > 0 ? (
        <div className="pointer-events-none absolute top-1/2 left-3 z-10 flex w-[min(230px,86vw)] -translate-y-1/2 flex-col gap-2 lg:left-4">
          {left.map((panel) => (
            <HudPanelCard
              key={panel.id}
              panel={panel}
              side="left"
              fading={panel.fading}
            />
          ))}
        </div>
      ) : null}

      {right.length > 0 ? (
        <div className="pointer-events-none absolute top-1/2 right-3 z-10 flex w-[min(230px,86vw)] -translate-y-1/2 flex-col gap-2 lg:right-4">
          {right.map((panel) => (
            <HudPanelCard
              key={panel.id}
              panel={panel}
              side="right"
              fading={panel.fading}
            />
          ))}
        </div>
      ) : null}

      {reply ? (
        <div
          className={`reply-box pointer-events-none absolute inset-x-0 z-20 mx-auto w-[min(92%,42rem)] border border-cyan/30 bg-[#01060b]/90 px-4 py-3 ${
            interactive ? "bottom-16" : "bottom-3"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="hud-mono text-[9px] tracking-[0.28em] text-cyan/55">
            {awaiting ? "DRAFT" : "ARROL"}
          </p>
          <p className="mt-1 text-[15px] leading-snug font-light text-ink">{reply}</p>
        </div>
      ) : null}

      {interactive ? (
        <form
          className="absolute inset-x-0 bottom-3 z-20 mx-auto flex w-[min(92%,42rem)] items-center gap-2 border border-cyan/25 bg-[#01060b]/85 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            const value = typedRef.current?.value.trim() ?? "";
            if (!value) return;
            if (typedRef.current) typedRef.current.value = "";
            listening.current = false;
            genRef.current += 1;
            speakAbort.current?.abort();
            ioRef.current?.player.stop();
            void ioRef.current?.recorder.stop();
            analyserRef.current = null;
            setFinalText(value);
            fire(value);
          }}
        >
          <span className="hud-mono shrink-0 text-[9px] tracking-[0.22em] text-cyan/50">
            TYPE
          </span>
          <input
            ref={typedRef}
            type="text"
            disabled={busy}
            placeholder="type if needed"
            autoComplete="off"
            className="hud-field mt-0 min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-[13px] tracking-normal"
          />
        </form>
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) {
    return true;
  }
  return Boolean(target.closest("a, button, [href], [role='button']"));
}
