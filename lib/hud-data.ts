export type Severity = "cyan" | "amber" | "red";

export type HudRow = {
  id: string;
  title: string;
  meta: string;
  severity: Severity;
  placeholder?: true;
};

export type HudMetric = {
  value: string;
  unit: string;
  spark: number[];
  gauges: Array<{ label: string; pct: number }>;
};

export type HudPanel = {
  id: string;
  title: string;
  count: number;
  rows: HudRow[];
  metric?: HudMetric;
  side: "left" | "right";
};

export type PanelToolMeta = {
  id: string;
  title: string;
  side: "left" | "right";
};

export const PANEL_TOOLS: Record<string, PanelToolMeta> = {
  get_todays_schedule: { id: "schedule", title: "SCHEDULE", side: "left" },
  get_outstanding: { id: "outstanding", title: "OUTSTANDING", side: "left" },
  get_pipeline: { id: "pipeline", title: "PIPELINE", side: "left" },
  get_needs_reply: { id: "reply", title: "NEEDS A REPLY", side: "right" },
  get_channels: { id: "channels", title: "CHANNELS", side: "right" },
  get_on_hold: { id: "hold", title: "ON HOLD", side: "right" },
};

export const PANEL_PAYLOADS: Record<string, Omit<HudPanel, "id" | "side" | "title">> = {
  get_todays_schedule: {
    count: 4,
    rows: [
      { id: "s1", title: "08:40  COLLECTION  R88 TMR", meta: "BAY 2", severity: "cyan", placeholder: true },
      { id: "s2", title: "10:15  DELIVERY  LO64 UPR", meta: "EN ROUTE", severity: "cyan", placeholder: true },
      { id: "s3", title: "13:00  QUOTE  BMW M5", meta: "HOLD", severity: "amber", placeholder: true },
      { id: "s4", title: "16:20  HANDOVER  N123 ABC", meta: "TODAY", severity: "cyan", placeholder: true },
    ],
  },
  get_outstanding: {
    count: 3,
    rows: [
      { id: "o1", title: "INVOICE 1042  UNPAID", meta: "3D", severity: "amber", placeholder: true },
      { id: "o2", title: "QUOTE AUTH  8821", meta: "WAIT", severity: "cyan", placeholder: true },
      { id: "o3", title: "PHOTOS  WALK-ROUND", meta: "STALE", severity: "red", placeholder: true },
    ],
  },
  get_pipeline: {
    count: 12,
    metric: {
      value: "12",
      unit: "LIVE JOBS",
      spark: [4, 6, 5, 8, 7, 9, 11, 10, 12, 12, 11, 12],
      gauges: [
        { label: "COLLECT", pct: 0.7 },
        { label: "GARAGE", pct: 0.45 },
        { label: "DELIVER", pct: 0.3 },
      ],
    },
    rows: [
      { id: "p1", title: "STAGE 2  QUOTATION", meta: "4", severity: "amber", placeholder: true },
      { id: "p2", title: "STAGE 4  COMPLETE", meta: "2", severity: "cyan", placeholder: true },
    ],
  },
  get_needs_reply: {
    count: 2,
    rows: [
      { id: "r1", title: "SLACK  #OPS  PARTS DELAY", meta: "12M", severity: "amber", placeholder: true },
      { id: "r2", title: "MAIL  CUSTOMER  ETA", meta: "1H", severity: "cyan", placeholder: true },
    ],
  },
  get_channels: {
    count: 4,
    metric: {
      value: "04",
      unit: "LINKED",
      spark: [2, 2, 3, 3, 4, 4, 3, 4, 4, 4, 4, 4],
      gauges: [
        { label: "CRM", pct: 1 },
        { label: "SLACK", pct: 1 },
        { label: "CAL", pct: 0.6 },
        { label: "VOICE", pct: 0.15 },
      ],
    },
    rows: [],
  },
  get_on_hold: {
    count: 1,
    rows: [
      { id: "h1", title: "JOB 771  WAITING PARTS", meta: "5D", severity: "red", placeholder: true },
    ],
  },
};

function asRow(raw: unknown, index: number): HudRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title : null;
  if (!title) return null;
  const severity =
    row.severity === "amber" || row.severity === "red" || row.severity === "cyan"
      ? row.severity
      : "cyan";
  return {
    id: typeof row.id === "string" ? row.id : `r${index}`,
    title,
    meta: typeof row.meta === "string" ? row.meta : "",
    severity,
  };
}

export function panelFromTool(name: string, result: string): HudPanel | null {
  const meta = PANEL_TOOLS[name];
  if (!meta) return null;
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    if (parsed.error) return null;
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.map(asRow).filter((row): row is HudRow => row !== null)
      : [];
    const metric =
      parsed.metric && typeof parsed.metric === "object"
        ? (parsed.metric as HudMetric)
        : undefined;
    const count =
      typeof parsed.count === "number"
        ? parsed.count
        : rows.length;
    return {
      id: meta.id,
      title: typeof parsed.title === "string" ? parsed.title : meta.title,
      side: meta.side,
      count,
      rows,
      metric,
    };
  } catch {
    return null;
  }
}
