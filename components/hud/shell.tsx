"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { formatClock } from "@/lib/uptime";

export function HudShell({
  children,
  timezone,
  modelLabel,
  linkUp,
  fxOn,
}: {
  children: ReactNode;
  timezone: string;
  modelLabel: string;
  linkUp: boolean;
  fxOn: boolean;
}) {
  const pathname = usePathname();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.fx = fxOn ? "on" : "off";
    document.documentElement.dataset.crt = fxOn ? "on" : "off";
  }, [fxOn]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  const clock = now ? formatClock(new Date(now), timezone) : "--:--:--";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-hud text-ink">
      <header className="hud-strip z-10 shrink-0 overflow-x-auto border-b">
        <Cell>
          <span className={linkUp ? "led" : "led led-red"} />
          {linkUp ? "LINK UP" : "LINK DOWN"}
        </Cell>
        <Cell>MDL {modelLabel}</Cell>
        <div className="ml-auto flex">
          <Cell className="text-cyan">{clock}</Cell>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">{children}</div>

      <footer className="hud-strip z-10 shrink-0 overflow-x-auto border-t">
        <div className="ml-auto flex">
          <Nav href="/today" active={pathname === "/today" || pathname === "/chat"}>
            CORE
          </Nav>
          <Nav href="/wall" active={pathname === "/wall"}>
            WALL
          </Nav>
          <Nav href="/admin/models" active={pathname.startsWith("/admin")}>
            MODELS
          </Nav>
          <Nav href="/settings" active={pathname === "/settings"}>
            CFG
          </Nav>
        </div>
      </footer>
    </div>
  );
}

function Cell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`hud-cell ${className}`}>{children}</span>;
}

function Nav({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`hud-cell ${active ? "text-cyan" : "hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
