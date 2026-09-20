import type { ToolDefinition } from "@/lib/agent/types";

export const GET_CURRENT_TIME_TOOL: ToolDefinition = {
  name: "get_current_time",
  description:
    "Returns the current date and time in the Europe/London timezone.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const AGENT_TOOLS: ToolDefinition[] = [GET_CURRENT_TIME_TOOL];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: string; isError: boolean }> {
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

  return {
    isError: true,
    content: JSON.stringify({
      error: `Unknown tool: ${name}`,
      arguments: args,
    }),
  };
}
