export function HudSatellites({
  sessionId,
  context,
  queue,
  timezone,
  spend,
}: {
  sessionId: string;
  context: string;
  queue: string;
  timezone: string;
  spend: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
      <Sat className="top-[12%] left-[4%]" label="SESSION" value={sessionId} line="right" />
      <Sat className="top-[12%] right-[4%]" label="CONTEXT" value={context} line="left" />
      <Sat className="top-[46%] left-0" label="CONFIRM Q" value={queue} line="right" />
      <Sat className="top-[46%] right-0" label="ZONE" value={timezone} line="left" />
      <Sat className="bottom-[10%] left-[8%]" label="SPEND TDY" value={spend} line="right" />
    </div>
  );
}

function Sat({
  className,
  label,
  value,
  line,
}: {
  className: string;
  label: string;
  value: string;
  line: "left" | "right";
}) {
  return (
    <div className={`absolute flex items-center gap-2 ${className}`}>
      {line === "left" ? <Hair /> : null}
      <div className={line === "left" ? "text-right" : "text-left"}>
        <p className="hud-mono text-[8px] tracking-[0.22em] text-cyan/40">{label}</p>
        <p className="hud-mono text-[11px] tracking-widest text-cyan/80">{value}</p>
      </div>
      {line === "right" ? <Hair /> : null}
    </div>
  );
}

function Hair() {
  return <span className="h-px w-8 bg-cyan/30" />;
}
