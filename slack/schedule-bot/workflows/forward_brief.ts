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

// A custom function is killed at 60s. Waiting inside it never reaches the DM.
// This step pauses the workflow for one minute, then the function runs.
ForwardBriefWorkflow.addStep(Schema.slack.functions.Delay, {
  minutes_to_delay: 1,
});

ForwardBriefWorkflow.addStep(ForwardBriefFunction, {
  channel_id: ForwardBriefWorkflow.inputs.channel_id,
  message_ts: ForwardBriefWorkflow.inputs.message_ts,
  text: ForwardBriefWorkflow.inputs.text,
});
