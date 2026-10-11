import { assertEquals } from "./assert.ts";
import { FORWARDED_BRIEFS_DATASTORE, OWNER_USER_ID } from "./constants.ts";
import {
  forwardBrief,
  type ForwardClient,
  type HistoryMessage,
} from "./forward.ts";

const BRIEF = [
  "*TOMORROW · Sunday 11 Oct*",
  "Nothing in the calendar tomorrow",
  "Full brief: <https://claude.ai/artifact/XXXX|claude.ai/artifact/…>",
  "ref: tomorrowbrief",
  "Sent using Claude",
].join("\n");

interface Posted {
  channel: string;
  text: string;
  blocks: { type: string; text: { text: string } }[];
}

function harness(historyText = ""): {
  client: ForwardClient;
  posts: Posted[];
  historyCalls: number;
  logs: string[];
  store: Map<string, { id: string; kind: string }>;
} {
  const store = new Map<string, { id: string; kind: string }>();
  const posts: Posted[] = [];
  const logs: string[] = [];
  let historyCalls = 0;
  const client: ForwardClient = {
    apps: {
      datastore: {
        get: ({ id }) => {
          const item = store.get(id);
          return Promise.resolve({ ok: true, item: item ?? {} });
        },
        put: ({ item }) => {
          store.set(item.id, item);
          return Promise.resolve({ ok: true });
        },
        delete: ({ id }) => {
          store.delete(id);
          return Promise.resolve({ ok: true });
        },
      },
    },
    conversations: {
      history: (args) => {
        historyCalls += 1;
        const source: HistoryMessage = {
          ts: "111.222",
          text: historyText,
          blocks: historyText ? undefined : [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*TODAY · Saturday 10 Oct*\nGarage\nref: todaybrief",
              },
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: "Sent using <@U0C95E48K96>" }],
            },
          ],
        };
        if (args.limit === 1) {
          return Promise.resolve({ ok: true, messages: [source] });
        }
        return Promise.resolve({ ok: true, messages: [] });
      },
    },
    chat: {
      postMessage: (args) => {
        posts.push(args);
        return Promise.resolve({ ok: true });
      },
    },
  };
  return {
    client,
    posts,
    get historyCalls() {
      return historyCalls;
    },
    logs,
    store,
  };
}

Deno.test("each ref type is forwarded once with its header", async () => {
  const cases = [
    ["todaybrief", "Schedule for today"],
    ["tomorrowbrief", "Schedule for tomorrow"],
    ["weekbrief", "Schedule for the week"],
  ] as const;

  for (const [ref, header] of cases) {
    const { client, posts, logs } = harness();
    const result = await forwardBrief(client, {
      channel_id: "C0C956MS6Q0",
      message_ts: `1.${ref}`,
      text: `Line one\nLine two\nref: ${ref}\nSent using Claude`,
    }, (line) => logs.push(line));
    assertEquals(result.ok, true);
    assertEquals(result.type, ref);
    assertEquals(posts.length, 1);
    assertEquals(posts[0].channel, OWNER_USER_ID);
    assertEquals(posts[0].text, "Line one\nLine two");
    assertEquals(posts[0].blocks[0].text.text, "Line one\nLine two");
    assertEquals(posts[0].blocks[0].text.text.includes(header), false);
    assertEquals(posts[0].blocks[0].text.text.includes("ref:"), false);
    assertEquals(logs.some((line) => line.includes("Line one")), false);
  }
});

Deno.test("Sunday copy containing TOMORROW with ref weekbrief is only the week", async () => {
  const { client, posts } = harness();
  const result = await forwardBrief(client, {
    channel_id: "C0C956MS6Q0",
    message_ts: "200.1",
    text: [
      "*TOMORROW · Sunday 11 Oct*",
      "Week plan",
      "ref: weekbrief",
    ].join("\n"),
  }, () => {});
  assertEquals(result.type, "weekbrief");
  assertEquals(posts.length, 1);
  assertEquals(posts[0].text.startsWith("TOMORROW · Sunday 11 Oct"), true);
  assertEquals(posts[0].text.includes("*"), false);
  assertEquals(posts[0].text.includes("Schedule for the week"), false);
  assertEquals(posts[0].text.includes("Schedule for tomorrow"), false);
  assertEquals(
    posts[0].blocks[0].text.text.includes("*TOMORROW · Sunday 11 Oct*"),
    true,
  );
  assertEquals(
    posts[0].blocks[0].text.text.includes("Schedule for tomorrow"),
    false,
  );
});

Deno.test("messages without a ref line are not forwarded", async () => {
  const { client, posts, store, logs } = harness();
  const result = await forwardBrief(client, {
    channel_id: "C0C956MS6Q0",
    message_ts: "300.1",
    text: "Nothing in the calendar tomorrow\nSent using Claude",
  }, (line) => logs.push(line));
  assertEquals(result.ok, true);
  assertEquals(result.type, "ignored");
  assertEquals(posts.length, 0);
  assertEquals(store.size, 0);
  assertEquals(
    logs[0],
    JSON.stringify({
      type: "ignored",
      ts: "300.1",
      result: "success",
    }),
  );
});

Deno.test("a message timestamp is forwarded only once", async () => {
  const { client, posts, store } = harness();
  const inputs = {
    channel_id: "C0C956MS6Q0",
    message_ts: "400.1",
    text: BRIEF,
  };
  const first = await forwardBrief(client, inputs, () => {});
  const second = await forwardBrief(client, inputs, () => {});
  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  assertEquals(posts.length, 1);
  assertEquals(store.size, 1);
  assertEquals(store.get("400.1")?.kind, "tomorrowbrief");
  assertEquals(posts[0].text.includes("http"), false);
  assertEquals(
    posts[0].blocks.map((block) => block.text.text).join("\n").includes(
      "<https://claude.ai/artifact/XXXX|claude.ai/artifact/…>",
    ),
    true,
  );
});

Deno.test("empty trigger text is loaded from conversations.history", async () => {
  const box = harness();
  const result = await forwardBrief(box.client, {
    channel_id: "C0C956MS6Q0",
    message_ts: "111.222",
    text: "",
  }, (line) => box.logs.push(line));
  assertEquals(result.ok, true);
  assertEquals(result.type, "todaybrief");
  assertEquals(box.historyCalls, 2);
  assertEquals(box.posts.length, 1);
  assertEquals(box.posts[0].channel, OWNER_USER_ID);
  assertEquals(box.posts[0].text.startsWith("TODAY · Saturday 10 Oct"), true);
  assertEquals(box.posts[0].text.includes("*"), false);
  assertEquals(box.posts[0].text.toLowerCase().includes("sent using"), false);
  assertEquals(
    box.posts.every((post) =>
      post.blocks.every((block) => block.type === "section")
    ),
    true,
  );
  assertEquals(box.posts[0].blocks[0].text.text.includes("Garage"), true);
  assertEquals(box.posts[0].blocks[0].text.text.includes("ref:"), false);
  assertEquals(box.logs.some((line) => line.includes("Garage")), false);
  assertEquals(box.store.get("111.222")?.id, "111.222");
  assertEquals(FORWARDED_BRIEFS_DATASTORE, "forwarded_briefs");
});

Deno.test("a failed send drops the claim so a later attempt can send", async () => {
  const box = harness();
  let fail = true;
  box.client.chat.postMessage = (args) => {
    box.posts.push(args);
    if (fail) return Promise.resolve({ ok: false });
    return Promise.resolve({ ok: true });
  };
  const inputs = {
    channel_id: "C0C956MS6Q0",
    message_ts: "500.1",
    text: "Standup\nref: todaybrief",
  };
  const failed = await forwardBrief(box.client, inputs, () => {});
  assertEquals(failed.ok, false);
  assertEquals(box.store.size, 0);
  fail = false;
  const retried = await forwardBrief(box.client, inputs, () => {});
  assertEquals(retried.ok, true);
  assertEquals(box.posts.length, 2);
  assertEquals(box.store.size, 1);
});

function channel(messages: HistoryMessage[]): {
  client: ForwardClient;
  posts: Posted[];
} {
  const store = new Map<string, { id: string; kind: string }>();
  const posts: Posted[] = [];
  const client: ForwardClient = {
    apps: {
      datastore: {
        get: ({ id }) => {
          const item = store.get(id);
          return Promise.resolve({ ok: true, item: item ?? {} });
        },
        put: ({ item }) => {
          store.set(item.id, item);
          return Promise.resolve({ ok: true });
        },
        delete: ({ id }) => {
          store.delete(id);
          return Promise.resolve({ ok: true });
        },
      },
    },
    conversations: {
      history: () => Promise.resolve({ ok: true, messages }),
    },
    chat: {
      postMessage: (args) => {
        posts.push(args);
        return Promise.resolve({ ok: true });
      },
    },
  };
  return { client, posts };
}

Deno.test("two posts 20s apart forward only the second", async () => {
  const older = "1700000000.000100";
  const newer = "1700000020.000100";
  const messages: HistoryMessage[] = [
    { ts: newer, text: "Second version\nref: tomorrowbrief" },
    { ts: older, text: "First version\nref: tomorrowbrief" },
  ];
  const box = channel(messages);
  const first = await forwardBrief(box.client, {
    channel_id: "C0C956MS6Q0",
    message_ts: older,
    text: "First version\nref: tomorrowbrief",
  }, () => {});
  const second = await forwardBrief(box.client, {
    channel_id: "C0C956MS6Q0",
    message_ts: newer,
    text: "Second version\nref: tomorrowbrief",
  }, () => {});
  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  assertEquals(box.posts.length, 1);
  assertEquals(box.posts[0].text, "Second version");
  assertEquals(box.posts[0].blocks[0].text.text, "Second version");
});

Deno.test("a single post is forwarded after the debounce", async () => {
  const ts = "1700000000.000100";
  const box = channel([{ ts, text: "Only version\nref: todaybrief" }]);
  const result = await forwardBrief(box.client, {
    channel_id: "C0C956MS6Q0",
    message_ts: ts,
    text: "Only version\nref: todaybrief",
  }, () => {});
  assertEquals(result.ok, true);
  assertEquals(result.type, "todaybrief");
  assertEquals(box.posts.length, 1);
  assertEquals(box.posts[0].blocks[0].text.text, "Only version");
});
