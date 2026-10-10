import { assert, assertEquals } from "./assert.ts";
import {
  messageBlocks,
  prepareBrief,
  SECTION_LIMIT,
  textFromMessage,
} from "./brief.ts";

const TOMORROW = [
  "*TOMORROW · Sunday 11 Oct*",
  "Nothing in the calendar tomorrow",
  "Clashes: none · Unanswered invites: none",
  "Full brief: <https://claude.ai/artifact/XXXX|claude.ai/artifact/…>",
  "ref: tomorrowbrief",
  "_Sent using Claude_",
].join("\n");

Deno.test("today, tomorrow, and week refs choose their own headers", () => {
  const today = prepareBrief("Standup at 9\nref: todaybrief");
  const tomorrow = prepareBrief(TOMORROW);
  const week = prepareBrief("Monday through Friday\nref: weekbrief");

  assert(today);
  assert(tomorrow);
  assert(week);
  assertEquals(today.header, "Schedule for today");
  assertEquals(tomorrow.header, "Schedule for tomorrow");
  assertEquals(week.header, "Schedule for the week");
  assertEquals(today.message.startsWith("*Schedule for today*\n"), true);
  assertEquals(tomorrow.kind, "tomorrowbrief");
  assertEquals(week.kind, "weekbrief");
});

Deno.test("a Sunday brief that says TOMORROW stays a week brief", () => {
  const sunday = [
    "*TOMORROW · Sunday 11 Oct*",
    "The week ahead",
    "ref: weekbrief",
    "Sent using Claude",
  ].join("\n");
  const brief = prepareBrief(sunday);

  assert(brief);
  assertEquals(brief.kind, "weekbrief");
  assertEquals(brief.header, "Schedule for the week");
  assertEquals(brief.message.includes("Schedule for tomorrow"), false);
  assertEquals(brief.body.includes("*TOMORROW · Sunday 11 Oct*"), true);
  assertEquals(brief.body.includes("The week ahead"), true);
});

Deno.test("ref lines and Claude footers are removed and the brief text stays", () => {
  const brief = prepareBrief(TOMORROW);

  assert(brief);
  assertEquals(brief.body.includes("ref:"), false);
  assertEquals(brief.body.toLowerCase().includes("sent using claude"), false);
  assertEquals(
    brief.body,
    [
      "*TOMORROW · Sunday 11 Oct*",
      "Nothing in the calendar tomorrow",
      "Clashes: none · Unanswered invites: none",
      "Full brief: <https://claude.ai/artifact/XXXX|claude.ai/artifact/…>",
    ].join("\n"),
  );
  assertEquals(
    brief.message,
    `*Schedule for tomorrow*\n${brief.body}`,
  );
});

Deno.test("messages without a ref line are ignored", () => {
  assertEquals(prepareBrief("Nothing in the calendar tomorrow"), null);
  assertEquals(prepareBrief("See you TOMORROW"), null);
  assertEquals(
    prepareBrief("Notes mention ref: tomorrowbrief inside a sentence"),
    null,
  );
  assertEquals(
    prepareBrief(
      "Full brief: <https://claude.ai/artifact/tomorrowbrief|link>",
    ),
    null,
  );
});

Deno.test("the last ref line decides the type", () => {
  const brief = prepareBrief("ref: tomorrowbrief\nWeek plan\nref: weekbrief");
  assert(brief);
  assertEquals(brief.kind, "weekbrief");
  assertEquals(brief.body.includes("ref:"), false);
});

Deno.test("notification text is the header plus two content lines and no raw URL", () => {
  const brief = prepareBrief(TOMORROW);
  assert(brief);
  assertEquals(
    brief.notification,
    [
      "Schedule for tomorrow",
      "TOMORROW · Sunday 11 Oct",
      "Nothing in the calendar tomorrow",
    ].join("\n"),
  );
  assertEquals(brief.notification.includes("http"), false);

  const linksFirst = prepareBrief([
    "<https://claude.ai/artifact/XXXX|https://claude.ai/artifact/XXXX>",
    "https://example.com/only-a-url",
    "Standup at 9",
    "Design review",
    "ref: todaybrief",
  ].join("\n"));
  assert(linksFirst);
  assertEquals(linksFirst.notification.includes("http"), false);
  assertEquals(
    linksFirst.notification,
    [
      "Schedule for today",
      "Standup at 9",
      "Design review",
    ].join("\n"),
  );
});

Deno.test("empty message text is rebuilt from blocks", () => {
  const text = textFromMessage({
    text: "  ",
    blocks: [
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              { type: "text", text: "TODAY · Saturday 10 Oct" },
            ],
          },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "Shop time\nref: todaybrief" },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "_Sent using Claude_" }],
      },
    ],
  });
  const brief = prepareBrief(text);
  assert(brief);
  assertEquals(brief.kind, "todaybrief");
  assertEquals(brief.body.includes("Shop time"), true);
  assertEquals(brief.body.includes("TODAY · Saturday 10 Oct"), true);
  assertEquals(brief.body.includes("ref:"), false);
  assertEquals(brief.body.toLowerCase().includes("sent using claude"), false);
});

Deno.test("long briefs are split into section blocks without dropping text", () => {
  const body = `${"a".repeat(SECTION_LIMIT)}\n${"b".repeat(20)}`;
  const brief = prepareBrief(`${body}\nref: todaybrief`);
  assert(brief);
  const blocks = messageBlocks(brief.message);
  assert(blocks.length > 1);
  assertEquals(
    blocks.map((block) => block.text.text).join("\n"),
    brief.message,
  );
  for (const block of blocks) {
    assert(block.text.text.length <= SECTION_LIMIT);
  }
});
