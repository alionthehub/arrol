import { Manifest } from "deno-slack-sdk/mod.ts";
import { ForwardedBriefsDatastore } from "./datastores/forwarded_briefs.ts";
import { ForwardBriefWorkflow } from "./workflows/forward_brief.ts";

export default Manifest({
  name: "Schedule",
  displayName: "Schedule",
  description: "Forwards #schedule calendar briefs as a direct message.",
  icon: "assets/default_new_app_icon.png",
  workflows: [ForwardBriefWorkflow],
  datastores: [ForwardedBriefsDatastore],
  outgoingDomains: [],
  botScopes: [
    "chat:write",
    "im:write",
    "groups:history",
    "channels:history",
    "im:read",
    "mpim:read",
    "datastore:read",
    "datastore:write",
  ],
});
