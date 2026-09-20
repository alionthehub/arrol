"use client";

export function MicControl() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-3">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby="mic-tip"
        className="mic-pulse relative flex h-28 w-28 flex-col items-center justify-center border border-phosphor-dim text-phosphor-dim sm:h-36 sm:w-36"
      >
        <Waveform />
        <span className="mt-2 text-[10px] tracking-[0.2em]">HOLD</span>
      </button>
      <p id="mic-tip" role="tooltip" className="text-center text-[11px] tracking-widest text-amber">
        VOICE MODULE OFFLINE
      </p>
    </div>
  );
}

function Waveform() {
  const bars = [8, 16, 24, 18, 28, 14, 22, 10, 20, 12, 26, 9];
  return (
    <div className="flex h-10 items-end gap-0.5" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="wave-bar inline-block w-1 bg-phosphor-dim"
          style={{
            height: h,
            animationDelay: `${i * 70}ms`,
          }}
        />
      ))}
    </div>
  );
}
