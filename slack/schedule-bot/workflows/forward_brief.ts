import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ForwardBriefFunction } from "../functions/forward_brief.ts";

export const ForwardBriefWorkflow = DefineWorkflow({
  callback_id: "forward_brief_workflow",
  title: "Forward schedule brief",
  description: "Send a #schedule calendar brief as a direct message",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.types.string },
      text: { type: Schema.types.string },
    },
    required: ["channel_id", "message_ts"],
  },
});

ForwardBriefWorkflow.addStep(ForwardBriefFunction, {
  channel_id: ForwardBriefWorkflow.inputs.channel_id,
  message_ts: ForwardBriefWorkflow.inputs.message_ts,
  text: ForwardBriefWorkflow.inputs.text,
});
