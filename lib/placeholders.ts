/** Clearly-marked stand-in data until live tools are wired. */
export const PLACEHOLDER_BANNER = "PLACEHOLDER DATA — LIVE TOOLS NOT WIRED";

export type StatusItem = {
  id: string;
  glyph: string;
  title: string;
  time: string;
  status: string;
  placeholder: true;
};

export type TodayReadout = {
  placeholder: true;
  generatedAtLabel: string;
  priority: StatusItem[];
  schedule: StatusItem[];
  incoming: StatusItem[];
  feeds: Array<{ id: string; label: string; status: "AWAITING SIGNAL" }>;
};

export const TODAY_PLACEHOLDER: TodayReadout = {
  placeholder: true,
  generatedAtLabel: "SYNTHETIC READOUT",
  priority: [
    {
      id: "p1",
      glyph: "●",
      title: "BRIEFING_PACKET",
      time: "08:00",
      status: "READY",
      placeholder: true,
    },
    {
      id: "p2",
      glyph: "○",
      title: "DENTAL_RECALL",
      time: "14:30",
      status: "HOLD",
      placeholder: true,
    },
    {
      id: "p3",
      glyph: "●",
      title: "SUPPLY_INVENTORY",
      time: "16:00",
      status: "FLAGGED",
      placeholder: true,
    },
  ],
  schedule: [
    {
      id: "s1",
      glyph: "▸",
      title: "SHIFT_HANDOVER",
      time: "09:00",
      status: "PENDING",
      placeholder: true,
    },
    {
      id: "s2",
      glyph: "▸",
      title: "COMMS_CHECK",
      time: "12:15",
      status: "PENDING",
      placeholder: true,
    },
  ],
  incoming: [],
  feeds: [
    { id: "f1", label: "FEED 1 / OPS", status: "AWAITING SIGNAL" },
    { id: "f2", label: "FEED 2 / EXT", status: "AWAITING SIGNAL" },
  ],
};

export const EMPTY_LABEL = "NO PENDING ITEMS";
