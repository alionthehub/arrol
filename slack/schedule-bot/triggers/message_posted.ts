import { Trigger } from "deno-slack-sdk/types.ts";
import {
  TriggerContextData,
  TriggerEventTypes,
  TriggerTypes,
} from "deno-slack-api/mod.ts";
import { SCHEDULE_CHANNEL_ID } from "../lib/constants.ts";
import { ForwardBriefWorkflow } from "../workflows/forward_brief.ts";

const messagePosted: Trigger<typeof ForwardBriefWorkflow.definition> = {
  type: TriggerTypes.Event,
  name: "Forward schedule briefs",
  description: "DM calendar briefs posted in #schedule",
  workflow: `#/workflows/${ForwardBriefWorkflow.definition.callback_id}`,
  event: {
    event_type: TriggerEventTypes.MessagePosted,
    channel_ids: [SCHEDULE_CHANNEL_ID],
    filter: {
      version: 1,
      root: {
        operator: "OR",
        inputs: [
          { statement: "{{data.text}} CONTAINS 'todaybrief'" },
          { statement: "{{data.text}} CONTAINS 'tomorrowbrief'" },
          { statement: "{{data.text}} CONTAINS 'weekbrief'" },
        ],
      },
    },
  },
  inputs: {
    channel_id: {
      value: TriggerContextData.Event.MessagePosted.channel_id,
    },
    message_ts: {
      value: TriggerContextData.Event.MessagePosted.message_ts,
    },
    text: {
      value: TriggerContextData.Event.MessagePosted.text,
    },
  },
};

export default messagePosted;
