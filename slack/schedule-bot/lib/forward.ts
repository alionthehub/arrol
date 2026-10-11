import {
  messageBlocks,
  type MrkdwnBlock,
  prepareBrief,
  type SlackBlock,
  textFromMessage,
} from "./brief.ts";
import { FORWARDED_BRIEFS_DATASTORE, OWNER_USER_ID } from "./constants.ts";

export interface HistoryMessage {
  ts?: string;
  text?: string;
  blocks?: SlackBlock[];
}

export interface DatastoreGetResponse {
  ok: boolean;
  item?: { id?: string };
}

export interface ForwardClient {
  apps: {
    datastore: {
      get: (args: { datastore: string; id: string }) => Promise<
        DatastoreGetResponse
      >;
      put: (args: {
        datastore: string;
        item: { id: string; kind: string; forwarded_at: string };
      }) => Promise<{ ok: boolean }>;
      delete: (args: { datastore: string; id: string }) => Promise<
        { ok: boolean }
      >;
    };
  };
  conversations: {
    history: (args: {
      channel: string;
      limit: number;
      latest?: string;
      inclusive?: boolean;
    }) => Promise<{ ok: boolean; messages?: HistoryMessage[] }>;
  };
  chat: {
    postMessage: (args: {
      channel: string;
      text: string;
      blocks: MrkdwnBlock[];
      unfurl_links: boolean;
      unfurl_media: boolean;
    }) => Promise<{ ok: boolean }>;
  };
}

export interface ForwardInputs {
  channel_id: string;
  message_ts: string;
  text?: string | null;
}

export interface ForwardResult {
  ok: boolean;
  type: string;
}

export const DEBOUNCE_MS = 60_000;
export const RECENT_HISTORY_LIMIT = 10;

export interface ForwardOptions {
  sleep?: (ms: number) => Promise<void>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNewer(candidate: string, current: string): boolean {
  const left = Number(candidate);
  const right = Number(current);
  return Number.isFinite(left) && Number.isFinite(right) && left > right;
}

export async function forwardBrief(
  client: ForwardClient,
  inputs: ForwardInputs,
  log: (line: string) => void = console.log,
  options: ForwardOptions = {},
): Promise<ForwardResult> {
  const ts = inputs.message_ts;
  const finish = (ok: boolean, type: string): ForwardResult => {
    log(JSON.stringify({ type, ts, result: ok ? "success" : "failure" }));
    return { ok, type };
  };

  const provided = typeof inputs.text === "string" ? inputs.text : "";
  let raw = provided;
  if (!provided.trim()) {
    const history = await client.conversations.history({
      channel: inputs.channel_id,
      latest: inputs.message_ts,
      inclusive: true,
      limit: 1,
    });
    if (!history.ok) return finish(false, "unknown");
    const message = history.messages?.find((item) => item.ts === ts);
    if (!message) return finish(false, "unknown");
    raw = textFromMessage(message);
  }

  const brief = prepareBrief(raw);
  if (!brief) return finish(true, "ignored");

  const existing = await client.apps.datastore.get({
    datastore: FORWARDED_BRIEFS_DATASTORE,
    id: ts,
  });
  if (!existing.ok) return finish(false, brief.kind);
  if (existing.item?.id) return finish(true, brief.kind);

  await (options.sleep ?? wait)(DEBOUNCE_MS);

  const again = await client.apps.datastore.get({
    datastore: FORWARDED_BRIEFS_DATASTORE,
    id: ts,
  });
  if (!again.ok) return finish(false, brief.kind);
  if (again.item?.id) return finish(true, brief.kind);

  const recent = await client.conversations.history({
    channel: inputs.channel_id,
    limit: RECENT_HISTORY_LIMIT,
  });
  if (!recent.ok) return finish(false, brief.kind);
  const superseded = (recent.messages ?? []).some((message) => {
    if (!message.ts || !isNewer(message.ts, ts)) return false;
    const newer = prepareBrief(textFromMessage(message));
    return newer?.kind === brief.kind;
  });
  if (superseded) return finish(true, brief.kind);

  const claim = await client.apps.datastore.put({
    datastore: FORWARDED_BRIEFS_DATASTORE,
    item: {
      id: ts,
      kind: brief.kind,
      forwarded_at: new Date().toISOString(),
    },
  });
  if (!claim.ok) return finish(false, brief.kind);

  const posted = await client.chat.postMessage({
    channel: OWNER_USER_ID,
    text: brief.notification,
    blocks: messageBlocks(brief.message),
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!posted.ok) {
    await client.apps.datastore.delete({
      datastore: FORWARDED_BRIEFS_DATASTORE,
      id: ts,
    });
    return finish(false, brief.kind);
  }

  return finish(true, brief.kind);
}
