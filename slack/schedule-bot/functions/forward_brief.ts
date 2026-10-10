import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { forwardBrief, type ForwardClient } from "../lib/forward.ts";

export const ForwardBriefFunction = DefineFunction({
  callback_id: "forward_brief",
  title: "Forward brief",
  description: "DM a calendar brief posted in #schedule",
  source_file: "functions/forward_brief.ts",
  input_parameters: {
    properties: {
      channel_id: {
        type: Schema.slack.types.channel_id,
        description: "Channel the brief was posted in",
      },
      message_ts: {
        type: Schema.types.string,
        description: "Timestamp of the posted message",
      },
      text: {
        type: Schema.types.string,
        description: "Posted message text",
      },
    },
    required: ["channel_id", "message_ts"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

export default SlackFunction(
  ForwardBriefFunction,
  async ({ inputs, client }) => {
    try {
      const result = await forwardBrief(client as unknown as ForwardClient, {
        channel_id: inputs.channel_id,
        message_ts: inputs.message_ts,
        text: inputs.text,
      });
      if (!result.ok) return { error: "forward_failed" };
      return { outputs: {} };
    } catch {
      console.log(JSON.stringify({
        type: "unknown",
        ts: inputs.message_ts,
        result: "failure",
      }));
      return { error: "forward_failed" };
    }
  },
);
