import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";
import { FORWARDED_BRIEFS_DATASTORE } from "../lib/constants.ts";

export const ForwardedBriefsDatastore = DefineDatastore({
  name: FORWARDED_BRIEFS_DATASTORE,
  primary_key: "id",
  attributes: {
    id: { type: Schema.types.string },
    kind: { type: Schema.types.string },
    forwarded_at: { type: Schema.types.string },
  },
});
