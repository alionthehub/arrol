import type { HudPanel } from "@/lib/hud-data";

export function HudPanelCard({
  panel,
  side,
  fading = false,
}: {
  panel: HudPanel;
  side: "left" | "right";
  fading?: boolean;
}) {
  return (
    <section
      data-side={side}
      className={`hud-card hud-card-panel pointer-events-auto ${fading ? "hud-panel-out" : "hud-panel-in"}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="hud-mono text-[10px] tracking-[0.22em] text-cyan">
          {panel.title}
        </h2>
        <span className="h-px min-w-4 flex-1 bg-cyan/20" />
        <span className="hud-mono text-[11px] text-cyan/70">
          {String(panel.count).padStart(2, "0")}
        </span>
      </header>

      {panel.metric ? (
        <div className="mb-2">
          <p className="hud-metric leading-none font-light tracking-tight text-ink">
            {panel.metric.value}
          </p>
          <p className="hud-mono mt-1 text-[9px] tracking-[0.2em] text-cyan/50">
            {panel.metric.unit}
          </p>
          <Sparkline values={panel.metric.spark} />
          <div className="mt-2 space-y-1">
            {panel.metric.gauges.map((gauge) => (
              <div key={gauge.label} className="flex items-center gap-2">
                <span className="hud-mono w-12 text-[8px] tracking-widest text-cyan/45">
                  {gauge.label}
                </span>
                <span className="h-px flex-1 bg-cyan/15">
                  <span
                    className="block h-px bg-cyan"
                    style={{ width: `${Math.round(gauge.pct * 100)}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {panel.rows.length === 0 && !panel.metric ? (
        <p className="hud-mono py-3 text-center text-[10px] tracking-widest text-cyan/40">
          NO PENDING ITEMS
        </p>
      ) : (
        <ul className="space-y-1">
          {panel.rows.map((row) => (
            <li
              key={row.id}
              className={`severity-${row.severity} flex items-baseline justify-between gap-2 py-1 pl-2 text-[13px] font-light`}
            >
              <span className="min-w-0 truncate">{row.title}</span>
              <span
                className={`hud-mono shrink-0 text-[9px] tracking-widest ${
                  row.severity === "red"
                    ? "text-stale"
                    : row.severity === "amber"
                      ? "text-amber"
                      : "text-cyan/55"
                }`}
              >
                {row.meta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = Number.parseFloat(((i / (values.length - 1)) * 100).toFixed(3));
      const y = Number.parseFloat((18 - (v / max) * 16).toFixed(3));
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 20" className="mt-2 h-5 w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke="#4ae3ff"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        points={pts}
      />
    </svg>
  );
}
