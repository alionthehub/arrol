"use client";

import { useEffect, useId, useRef, type MutableRefObject } from "react";

const CX = 320;
const CY = 320;
const BARS = 120;
const INNER = 126;
const SPAN = 44;

function r3(n: number) {
  return Number.parseFloat(n.toFixed(3));
}

function at(angle: number, radius: number) {
  return {
    x: r3(CX + Math.cos(angle) * radius),
    y: r3(CY + Math.sin(angle) * radius),
  };
}

export type VoiceMode = "idle" | "listen" | "work" | "speak";

export function HudCore({
  mode,
  pulse,
  interactive,
  onToggle,
  stateLabel,
  clock,
  transcript,
  arcTop,
  arcBottom,
  analyserRef,
}: {
  mode: VoiceMode;
  pulse: number;
  interactive: boolean;
  onToggle: () => void;
  stateLabel: string;
  clock: string;
  transcript: string;
  arcTop: string;
  arcBottom: string;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
}) {
  const uid = useId().replace(/:/g, "");
  const barRefs = useRef<Array<SVGLineElement | null>>([]);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fxOff = document.documentElement.dataset.fx === "off";
    const quiet = reducedRef.current || fxOff;
    let freq = new Uint8Array(128);
    let t = 0;
    let raf = 0;
    const tick = () => {
      t += 0.045;
      const analyser = analyserRef?.current;
      const live = analyser && (mode === "listen" || mode === "speak");
      if (live && analyser) {
        if (freq.length !== analyser.frequencyBinCount) {
          freq = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freq);
        for (let i = 0; i < BARS; i += 1) {
          const bin = freq[Math.min(freq.length - 1, i)] / 255;
          const amp = 0.14 + Math.pow(bin, 0.72) * 0.86;
          setBar(barRefs.current[i], i, amp, 0.42 + amp * 0.5);
        }
      } else if (quiet) {
        for (let i = 0; i < BARS; i += 1) {
          setBar(barRefs.current[i], i, 0.38);
        }
      } else {
        for (let i = 0; i < BARS; i += 1) {
          setBar(barRefs.current[i], i, amplitude(mode, t, i));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, mode]);

  const ticks = Array.from({ length: 120 }, (_, i) => i);
  const degrees = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 640 640"
        className={`h-full w-full select-none ${interactive ? "cursor-pointer" : ""}`}
        role={interactive ? "button" : "img"}
        aria-label={
          interactive
            ? mode === "listen"
              ? "Voice core. Recording. Tap to stop and send."
              : "Voice core. Tap to start recording. Tap again to stop and send."
            : "Operations core"
        }
        aria-pressed={interactive ? mode === "listen" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={() => {
          if (!interactive) return;
          onToggle();
        }}
        onKeyDown={(event) => {
          if (!interactive) return;
          if (event.key === " ") {
            event.preventDefault();
            return;
          }
          if (event.key === "Enter" && !event.repeat) {
            event.preventDefault();
            onToggle();
          }
        }}
        style={{ touchAction: "manipulation" }}
      >
        <defs>
          <path
            id={`${uid}-top`}
            d="M 96 320 A 224 224 0 0 1 544 320"
            fill="none"
          />
          <path
            id={`${uid}-bot`}
            d="M 544 320 A 224 224 0 0 1 96 320"
            fill="none"
          />
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ae3ff" stopOpacity="0" />
            <stop offset="55%" stopColor="#4ae3ff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4ae3ff" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id={`${uid}-disc`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#041018" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#031018" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#4ae3ff" stopOpacity="0.12" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r="302" fill="none" stroke="#4ae3ff" strokeOpacity="0.08" />

        {/* 1 outer broken arc + nodes */}
        <g className="spin-cw" style={{ ["--dur" as string]: "86s" }}>
          <circle
            cx={CX}
            cy={CY}
            r="292"
            fill="none"
            stroke="#4ae3ff"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="70 28 18 40 90 32"
            strokeLinecap="round"
          />
          {[0, 52, 110, 168, 225, 300].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            const { x, y } = at(a, 292);
            return (
              <circle
                key={deg}
                cx={x}
                cy={y}
                r="2.4"
                fill="#4ae3ff"
              />
            );
          })}
        </g>

        {/* 2 heavy segmented band */}
        <circle
          className="spin-ccw"
          style={{ ["--dur" as string]: "54s" }}
          cx={CX}
          cy={CY}
          r="272"
          fill="none"
          stroke="#4ae3ff"
          strokeOpacity="0.7"
          strokeWidth="7"
          strokeDasharray="22 10"
        />

        {/* 3 dense tick ring */}
        <g className="spin-cw" style={{ ["--dur" as string]: "140s" }}>
          {ticks.map((i) => {
            const a = ((i * 3 - 90) * Math.PI) / 180;
            const major = i % 10 === 0;
            const a1 = at(a, 248);
            const a2 = at(a, major ? 236 : 242);
            return (
              <line
                key={i}
                x1={a1.x}
                y1={a1.y}
                x2={a2.x}
                y2={a2.y}
                stroke="#4ae3ff"
                strokeOpacity={major ? 0.7 : 0.28}
                strokeWidth={major ? 1.2 : 0.6}
              />
            );
          })}
          {degrees.map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            const { x, y } = at(a, 226);
            return (
              <text
                key={deg}
                x={x}
                y={y}
                fill="#4ae3ff"
                fillOpacity="0.55"
                fontSize="8"
                fontFamily="var(--font-hud-mono), monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {String(deg).padStart(3, "0")}
              </text>
            );
          })}
        </g>

        {/* 4 sweeping gradient arc */}
        <circle
          className="spin-cw"
          style={{ ["--dur" as string]: "16s" }}
          cx={CX}
          cy={CY}
          r="208"
          fill="none"
          stroke={`url(#${uid}-sweep)`}
          strokeWidth="6"
          strokeDasharray="220 900"
          strokeLinecap="round"
        />

        {/* 5 fine counter-rotating ring */}
        <circle
          className="spin-ccw"
          style={{ ["--dur" as string]: "28s" }}
          cx={CX}
          cy={CY}
          r="196"
          fill="none"
          stroke="#4ae3ff"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeDasharray="3 7"
        />

        {arcTop ? (
          <text fill="#4ae3ff" fillOpacity="0.55" fontSize="9" fontFamily="var(--font-hud-mono), monospace">
            <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
              {arcTop}
            </textPath>
          </text>
        ) : null}
        {arcBottom ? (
          <text fill="#4ae3ff" fillOpacity="0.45" fontSize="9" fontFamily="var(--font-hud-mono), monospace">
            <textPath href={`#${uid}-bot`} startOffset="50%" textAnchor="middle">
              {arcBottom}
            </textPath>
          </text>
        ) : null}

        {/* voice bars */}
        <g>
          {Array.from({ length: BARS }, (_, i) => {
            const a = (i / BARS) * Math.PI * 2 - Math.PI / 2;
            const inner = at(a, INNER);
            const outer = at(a, INNER + 10 + 0.38 * SPAN);
            return (
              <line
                key={i}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#4ae3ff"
                strokeOpacity="0.55"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        <circle cx={CX} cy={CY} r="118" fill={`url(#${uid}-disc)`} stroke="#4ae3ff" strokeOpacity="0.28" />

        {/* radar */}
        <g className="radar-rot">
          <path
            d={`M ${CX} ${CY} L ${CX} ${CY - 118} A 118 118 0 0 1 ${CX + 70} ${CY - 95} Z`}
            fill="#4ae3ff"
            fillOpacity="0.12"
          />
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 118}
            stroke="#4ae3ff"
            strokeOpacity="0.65"
            strokeWidth="1.2"
          />
        </g>
        <circle cx={CX} cy={CY} r="118" fill="none" stroke="#4ae3ff" strokeOpacity="0.12" />
        <circle cx={CX} cy={CY} r="78" fill="none" stroke="#4ae3ff" strokeOpacity="0.08" />
        <circle cx={CX} cy={CY} r="42" fill="none" stroke="#4ae3ff" strokeOpacity="0.08" />
        {[
          [348, 268],
          [292, 250],
          [360, 330],
          [274, 348],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#4ae3ff" fillOpacity="0.8" />
        ))}

        {pulse ? (
          <circle
            key={pulse}
            className="pulse-ring"
            cx={CX}
            cy={CY}
            r="150"
            fill="none"
            stroke="#4ae3ff"
            strokeWidth="2"
            style={{ transformOrigin: "320px 320px" }}
          />
        ) : null}

        {/* reticles */}
        {reticle(28, 28, 1, 1)}
        {reticle(612, 28, -1, 1)}
        {reticle(28, 612, 1, -1)}
        {reticle(612, 612, -1, -1)}
      </svg>

      <div className="pointer-events-none absolute inset-[28%] flex flex-col items-center justify-center text-center">
        {stateLabel ? (
          <p className="hud-mono text-[10px] tracking-[0.35em] text-cyan/80" aria-live="polite">
            {stateLabel}
          </p>
        ) : null}
        <p className="hud-mono mt-1 text-[clamp(1.8rem,5vw,3.4rem)] leading-none font-normal tracking-wide text-ink">
          {clock}
        </p>
        <p className="mt-3 max-w-[16rem] font-sans text-[15px] leading-snug font-light text-ink/90">
          {transcript ||
            (interactive
              ? mode === "listen"
                ? "TAP TO SEND"
                : "TAP TO SPEAK"
              : "LIVE READOUT")}
        </p>
      </div>
    </div>
  );
}

function amplitude(mode: VoiceMode, t: number, i: number) {
  if (mode === "idle") {
    return 0.32 + 0.14 * Math.sin(t * 0.7 + i * 0.11);
  }
  if (mode === "listen" || mode === "speak") {
    const a = Math.sin(t * 5.2 + i * 0.37);
    const b = Math.sin(t * 2.4 + i * 0.13);
    return 0.28 + 0.72 * Math.abs(a * b);
  }
  return 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.1 - i * 0.21));
}

function setBar(
  el: SVGLineElement | null,
  i: number,
  amp: number,
  opacity?: number,
) {
  if (!el) return;
  const a = (i / BARS) * Math.PI * 2 - Math.PI / 2;
  const inner = at(a, INNER);
  const outer = at(a, INNER + 10 + amp * SPAN);
  el.setAttribute("x1", String(inner.x));
  el.setAttribute("y1", String(inner.y));
  el.setAttribute("x2", String(outer.x));
  el.setAttribute("y2", String(outer.y));
  if (opacity !== undefined) {
    el.setAttribute("stroke-opacity", String(opacity));
  }
}

function reticle(x: number, y: number, dx: number, dy: number) {
  const len = 18;
  return (
    <g stroke="#4ae3ff" strokeOpacity="0.55" strokeWidth="1.2" fill="none">
      <line x1={x} y1={y} x2={x + len * dx} y2={y} />
      <line x1={x} y1={y} x2={x} y2={y + len * dy} />
    </g>
  );
}
