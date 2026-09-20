"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TerminalFrame } from "@/components/terminal";
import {
  EMPTY_LABEL,
  PLACEHOLDER_BANNER,
  type TodayReadout,
} from "@/lib/placeholders";
import { formatClock, formatWallDate } from "@/lib/uptime";

export function WallDisplay({
  timezone,
  operator,
  readout,
}: {
  timezone: string;
  operator: string;
  readout: TodayReadout;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [sweep, setSweep] = useState(false);

  useEffect(() => {
    let raf = requestAnimationFrame(() => setNow(new Date()));
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = window.setInterval(() => {
      setSweep(true);
      router.refresh();
      window.setTimeout(() => setSweep(false), 380);
    }, 30_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [router]);

  const clock = now ? formatClock(now, timezone) : "--:--:--";
  const date = now ? formatWallDate(now, timezone) : "";

  return (
    <div className="relative h-full overflow-hidden bg-void px-3 py-3 sm:px-6 sm:py-4">
      {sweep ? <div className="scan-sweep" aria-hidden="true" /> : null}

      <div className="mx-auto flex h-full max-w-none flex-col gap-3 px-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-[10px] tracking-[0.35em] text-phosphor-dim sm:text-xs">
            {`WALL / ${operator} / ${PLACEHOLDER_BANNER}`}
          </p>
          <p className="text-[10px] tracking-widest text-ice sm:text-xs">{date}</p>
        </div>

        <p
          className="crt-aberrate crt-glow leading-none font-medium tracking-tight text-ice"
          style={{ fontSize: "clamp(3.5rem, 18vw, 11rem)" }}
        >
          {clock}
        </p>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
          <TerminalFrame title="TODAY" className="lg:col-span-2">
            {readout.priority.length + readout.schedule.length === 0 ? (
              <p className="py-8 text-center text-2xl tracking-widest text-phosphor-dim">
                {EMPTY_LABEL}
              </p>
            ) : (
              <ul className="space-y-2">
                {[...readout.priority, ...readout.schedule].map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline gap-x-4 text-xl sm:text-3xl"
                  >
                    <span className="text-ice">{item.glyph}</span>
                    <span className="crt-glow tracking-wide">{item.title}</span>
                    <span className="text-ice">{item.time}</span>
                    <span
                      className={
                        item.status === "FLAGGED" || item.status === "HOLD"
                          ? "text-amber"
                          : "text-phosphor-dim"
                      }
                    >
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TerminalFrame>

          <div className="flex flex-col gap-3">
            {readout.feeds.map((feed) => (
              <TerminalFrame key={feed.id} title={feed.label} tone="amber" className="flex-1">
                <p className="py-6 text-center text-lg tracking-[0.25em] text-amber sm:text-2xl">
                  {feed.status}
                </p>
              </TerminalFrame>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
