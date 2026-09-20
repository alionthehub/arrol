"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { formatClock, formatUptime } from "@/lib/uptime";

const NAV = [
  { href: "/today", label: "TODAY", key: "1" },
  { href: "/chat", label: "CHAT", key: "2" },
  { href: "/wall", label: "WALL", key: "3" },
  { href: "/admin/models", label: "MODELS", key: "4" },
  { href: "/settings", label: "SETTINGS", key: "5" },
] as const;

export function ConsoleShell({
  children,
  startedAt,
  timezone,
  operator,
  modelLabel,
  linkUp,
  crtOn,
}: {
  children: ReactNode;
  startedAt: number;
  timezone: string;
  operator: string;
  modelLabel: string;
  linkUp: boolean;
  crtOn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.crt = crtOn ? "on" : "off";
  }, [crtOn]);

  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(() => {
      setNow(Date.now());
    });
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      const match = NAV.find(
        (item) => event.key === item.key || event.key === `F${item.key}`,
      );
      if (!match) return;
      event.preventDefault();
      router.push(match.href);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const clock = now ? formatClock(new Date(now), timezone) : "--:--:--";
  const uptime = now ? formatUptime(startedAt, now) : "--:--:--";

  return (
    <div className="flex h-dvh flex-col bg-void text-phosphor">
      <header className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-phosphor/40 px-2 py-1 text-[11px] tracking-wider sm:text-xs">
        <span className="crt-glow shrink-0 font-medium">ARROL</span>
        <Sep />
        <time className="shrink-0 text-ice" dateTime={now ? new Date(now).toISOString() : undefined}>
          {clock}
        </time>
        <Sep />
        <nav className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "crt-glow shrink-0 text-ice"
                    : "shrink-0 text-phosphor-dim hover:text-phosphor"
                }
              >
                <span className="hidden sm:inline">{item.key}:</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      <footer className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-phosphor/40 px-2 py-1 text-[11px] tracking-wider text-phosphor-dim sm:text-xs">
        <span className={linkUp ? "text-phosphor" : "text-deny"}>
          {linkUp ? "● LINK UP" : "● LINK DOWN"}
        </span>
        <Sep />
        <span className="hidden shrink-0 sm:inline">OP {operator}</span>
        <Sep className="hidden sm:inline" />
        <span className="min-w-0 truncate">MDL {modelLabel}</span>
        <Sep />
        <span className="shrink-0">UP {uptime}</span>
        <Sep />
        <span className="shrink-0">{crtOn ? "CRT ON" : "CRT OFF"}</span>
      </footer>
    </div>
  );
}

function Sep({ className = "" }: { className?: string }) {
  return (
    <span className={`text-phosphor-dim ${className}`} aria-hidden="true">
      │
    </span>
  );
}
