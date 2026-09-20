import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
    </div>
  );
}
