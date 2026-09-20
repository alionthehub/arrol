import { isSpokenYes } from "@/lib/agent/confirm";
import type { ToolDefinition } from "@/lib/agent/types";
import { PANEL_PAYLOADS, PANEL_TOOLS } from "@/lib/hud-data";

const emptyParams = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export const GET_CURRENT_TIME_TOOL: ToolDefinition = {
  name: "get_current_time",
  description:
    "Returns the current date and time in the Europe/London timezone.",
  parameters: emptyParams,
};

const SEND_OR_WRITE_TOOL: ToolDefinition = {
  name: "send_or_write",
  mutates: true,
  description:
    "Send a message, email, SMS, Slack post, or write/update a record. Call this before claiming anything was sent or written. The system holds the draft until the user says yes.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "send, email, post, write, or update",
      },
      channel: {
        type: "string",
        description: "Where it goes: slack, mail, sms, crm, note",
      },
      to: { type: "string", description: "Recipient, channel, or record." },
      subject: { type: "string" },
      body: { type: "string", description: "Exact draft to read back." },
    },
    required: ["action", "body"],
    additionalProperties: false,
  },
};

const PANEL_TOOL_DEFS: ToolDefinition[] = [
  {
    name: "get_todays_schedule",
    description:
      "Today's diary: collections, deliveries, quotes, handovers. Use when asked what is on today, the run, or the schedule.",
    parameters: emptyParams,
  },
  {
    name: "get_outstanding",
    description:
      "Unpaid, waiting, or stale items. Use when asked what is outstanding, overdue, or left undone.",
    parameters: emptyParams,
  },
  {
    name: "get_pipeline",
    description: "Live jobs in the pipeline and their stages.",
    parameters: emptyParams,
  },
  {
    name: "get_needs_reply",
    description: "Messages waiting for a reply (Slack, mail).",
    parameters: emptyParams,
  },
  {
    name: "get_channels",
    description: "Linked channel status: CRM, Slack, calendar, voice.",
    parameters: emptyParams,
  },
  {
    name: "get_on_hold",
    description: "Jobs parked or blocked. Use when asked what is waiting or stuck.",
    parameters: emptyParams,
  },
];

export const AGENT_TOOLS: ToolDefinition[] = [
  GET_CURRENT_TIME_TOOL,
  SEND_OR_WRITE_TOOL,
  ...PANEL_TOOL_DEFS,
];

const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: { userMessage: string },
): Promise<{ content: string; isError: boolean }> {
  const tool = TOOLS_BY_NAME.get(name);
  if (tool?.mutates && !isSpokenYes(context.userMessage)) {
    return {
      isError: false,
      content: JSON.stringify({
        status: "awaiting_confirmation",
        tool: name,
        draft: args,
        instruction:
          "Do not claim this was sent or written. Read the draft back verbatim. Wait for a clear yes.",
      }),
    };
  }

  if (name === "send_or_write") {
    return {
      isError: false,
      content: JSON.stringify({
        status: "queued",
        action: args.action ?? "send",
        channel: args.channel ?? null,
        to: args.to ?? null,
        subject: args.subject ?? null,
        body: args.body ?? "",
        note: "Placeholder. Not sent to a live channel.",
      }),
    };
  }

  if (name === "get_current_time") {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);
    return {
      isError: false,
      content: JSON.stringify({
        timezone: "Europe/London",
        datetime: formatted,
        iso: now.toISOString(),
      }),
    };
  }

  const meta = PANEL_TOOLS[name];
  const payload = PANEL_PAYLOADS[name];
  if (meta && payload) {
    return {
      isError: false,
      content: JSON.stringify({
        title: meta.title,
        ...payload,
      }),
    };
  }

  return {
    isError: true,
    content: JSON.stringify({
      error: `Unknown tool: ${name}`,
      arguments: args,
    }),
  };
}
