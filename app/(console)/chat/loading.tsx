import { TerminalLoading } from "@/components/terminal-status";

export default function Loading() {
  return (
    <div className="p-4">
      <TerminalLoading label="LOADING CHAT…" />
    </div>
  );
}
