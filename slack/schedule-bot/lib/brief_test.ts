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

Deno.test("today, tomorrow, and week refs choose their type without an added header", () => {
  const today = prepareBrief("Standup at 9\nref: todaybrief");
  const tomorrow = prepareBrief(TOMORROW);
  const week = prepareBrief("Monday through Friday\nref: weekbrief");

  assert(today);
  assert(tomorrow);
  assert(week);
  assertEquals(today.kind, "todaybrief");
  assertEquals(tomorrow.kind, "tomorrowbrief");
  assertEquals(week.kind, "weekbrief");
  assertEquals(today.message, "Standup at 9");
  assertEquals(today.header, "Standup at 9");
  assertEquals(today.message.includes("Schedule for today"), false);
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
  assertEquals(brief.header, "*TOMORROW · Sunday 11 Oct*");
  assertEquals(brief.message, brief.body);
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
  assertEquals(brief.message, brief.body);
  assertEquals(brief.message.startsWith("*TOMORROW · Sunday 11 Oct*"), true);
});

Deno.test("messages without a brief token are ignored", () => {
  assertEquals(prepareBrief("Nothing in the calendar tomorrow"), null);
  assertEquals(prepareBrief("See you TOMORROW"), null);
});

Deno.test("a short post containing todaybrief is a today brief", () => {
  const brief = prepareBrief("test todaybrief");
  assert(brief);
  assertEquals(brief.kind, "todaybrief");
  assertEquals(brief.header, "test todaybrief");
  assertEquals(brief.body, "test todaybrief");
  assertEquals(brief.message, "test todaybrief");
});

Deno.test("a ref line still beats the word TOMORROW and an earlier token", () => {
  const brief = prepareBrief("todaybrief\n*TOMORROW · Sunday 11 Oct*\nref: weekbrief");
  assert(brief);
  assertEquals(brief.kind, "weekbrief");
  assertEquals(brief.header, "todaybrief");
  assertEquals(brief.body.includes("todaybrief"), true);
  assertEquals(brief.body.includes("ref:"), false);
});

Deno.test("the last ref line decides the type", () => {
  const brief = prepareBrief("ref: tomorrowbrief\nWeek plan\nref: weekbrief");
  assert(brief);
  assertEquals(brief.kind, "weekbrief");
  assertEquals(brief.body.includes("ref:"), false);
});

Deno.test("notification text is the brief's first line and the next content line", () => {
  const brief = prepareBrief(TOMORROW);
  assert(brief);
  assertEquals(
    brief.notification,
    [
      "*TOMORROW · Sunday 11 Oct*",
      "Nothing in the calendar tomorrow",
    ].join("\n"),
  );
  assertEquals(brief.message.startsWith(brief.header), true);
});

const MONDAY = [
  "📅 *Schedule for tomorrow · Monday 12 Oct*",
  "Nothing in the calendar tomorrow.",
  "",
  "*Clashes:* None",
  "*Unanswered invites:* None",
  "",
  "ref: tomorrowbrief",
  "*Sent using* <@U0C95E48K96|Claude>",
].join("\n");

Deno.test("the DM is the brief, with no extra header, ref, or Claude footer", () => {
  const brief = prepareBrief(MONDAY);
  assert(brief);
  assertEquals(brief.kind, "tomorrowbrief");
  assertEquals(
    brief.message,
    [
      "📅 *Schedule for tomorrow · Monday 12 Oct*",
      "Nothing in the calendar tomorrow.",
      "",
      "*Clashes:* None",
      "*Unanswered invites:* None",
    ].join("\n"),
  );
  assertEquals(
    brief.notification,
    [
      "📅 *Schedule for tomorrow · Monday 12 Oct*",
      "Nothing in the calendar tomorrow.",
    ].join("\n"),
  );
  assertEquals(brief.message.includes("ref:"), false);
  assertEquals(brief.message.toLowerCase().includes("sent using"), false);
  assertEquals(brief.message.includes("<@"), false);
});

Deno.test("ref text and a Claude footer are removed when joined on one line", () => {
  const brief = prepareBrief(
    "Plan *ref: tomorrowbrief* *Sent using* <@U0C95E48K96|Claude>",
  );
  assert(brief);
  assertEquals(brief.kind, "tomorrowbrief");
  assertEquals(brief.message, "Plan");
  assertEquals(brief.message.includes("ref:"), false);
  assertEquals(brief.message.toLowerCase().includes("sent using"), false);
  assertEquals(brief.message.includes("<@"), false);
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
