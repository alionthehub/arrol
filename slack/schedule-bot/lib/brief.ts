export const BRIEF_KINDS = [
  "todaybrief",
  "tomorrowbrief",
  "weekbrief",
] as const;

export type BriefKind = (typeof BRIEF_KINDS)[number];

export const HEADERS: Record<BriefKind, string> = {
  todaybrief: "Schedule for today",
  tomorrowbrief: "Schedule for tomorrow",
  weekbrief: "Schedule for the week",
};

const REF_LINE = /^ref:\s*(todaybrief|tomorrowbrief|weekbrief)\s*$/;
const CLAUDE_FOOTER = /^sent using claude$/i;
const LABELED_LINK = /<([^|>]+)\|([^>]+)>/g;
const BARE_LINK = /<https?:\/\/[^>\s]+>/gi;
const RAW_URL = /https?:\/\/\S+/gi;

export const SECTION_LIMIT = 3000;

export interface SlackTextObject {
  type?: string;
  text?: string;
}

export interface SlackElement {
  type?: string;
  text?: string;
  url?: string;
  name?: string;
  elements?: SlackElement[];
}

export interface SlackBlock {
  type?: string;
  text?: string | SlackTextObject;
  fields?: SlackTextObject[];
  elements?: SlackElement[];
}

export interface PreparedBrief {
  kind: BriefKind;
  header: string;
  body: string;
  message: string;
  notification: string;
}

export interface MrkdwnBlock {
  type: "section";
  text: { type: "mrkdwn"; text: string };
}

/** Visible text used only to recognize a ref line or the Claude footer. */
export function visibleLine(line: string): string {
  return line.trim().replace(/^[*_~>\s]+|[*_~\s]+$/g, "").trim();
}

/**
 * A `ref:` line decides the type, and the last one wins.
 * A message with no ref line still matches the last todaybrief,
 * tomorrowbrief, or weekbrief token, so a short test post is forwarded.
 * Returns null when neither is present.
 */
export function prepareBrief(raw: string): PreparedBrief | null {
  const lines = raw.split(/\r?\n/);
  let kind: BriefKind | null = null;
  const kept: string[] = [];

  for (const line of lines) {
    const visible = visibleLine(line);
    const ref = REF_LINE.exec(visible);
    if (ref) {
      kind = ref[1] as BriefKind;
      continue;
    }
    if (CLAUDE_FOOTER.test(visible)) continue;
    kept.push(line);
  }

  if (!kind) {
    const tokens = raw.match(/\b(todaybrief|tomorrowbrief|weekbrief)\b/g);
    if (!tokens?.length) return null;
    kind = tokens[tokens.length - 1] as BriefKind;
  }

  while (kept.length > 0 && kept[0].trim() === "") kept.shift();
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();

  const header = HEADERS[kind];
  const body = kept.join("\n");
  const message = body.length > 0 ? `*${header}*\n${body}` : `*${header}*`;
  return {
    kind,
    header,
    body,
    message,
    notification: notificationText(header, body),
  };
}

/** Lock-screen text: plain header plus the first two lines that still contain words. */
export function notificationText(header: string, body: string): string {
  const picked: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const cleaned = line
      .replace(LABELED_LINK, "$2")
      .replace(BARE_LINK, "")
      .replace(RAW_URL, "")
      .replace(/[*_~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    picked.push(cleaned);
    if (picked.length === 2) break;
  }
  return [header, ...picked].join("\n");
}

export function messageBlocks(message: string): MrkdwnBlock[] {
  const chunks: string[] = [];
  let rest = message;
  while (rest.length > SECTION_LIMIT) {
    let cut = rest.lastIndexOf("\n", SECTION_LIMIT);
    if (cut < 1) cut = SECTION_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks.map((text) => ({
    type: "section",
    text: { type: "mrkdwn", text },
  }));
}

export function textFromMessage(message: {
  text?: string;
  blocks?: SlackBlock[];
}): string {
  if (typeof message.text === "string" && message.text.trim().length > 0) {
    return message.text;
  }
  if (!message.blocks?.length) return "";
  return message.blocks.map(blockText).filter((part) => part.length > 0).join(
    "\n",
  );
}

function textOf(value: string | SlackTextObject | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.text ?? "";
}

function blockText(block: SlackBlock): string {
  if (block.type === "rich_text") {
    return (block.elements ?? []).map(richElement).filter((part) =>
      part.length > 0
    ).join("\n");
  }

  const parts: string[] = [];
  const main = textOf(block.text);
  if (main) parts.push(main);
  for (const field of block.fields ?? []) {
    const fieldText = textOf(field);
    if (fieldText) parts.push(fieldText);
  }
  if (parts.length > 0) return parts.join("\n");
  if (block.elements?.length) {
    return block.elements.map(richElement).filter((part) => part.length > 0)
      .join("\n");
  }
  return "";
}

function richElement(element: SlackElement): string {
  if (element.type === "text") return element.text ?? "";
  if (element.type === "link") {
    if (element.url && element.text) return `<${element.url}|${element.text}>`;
    if (element.url) return `<${element.url}>`;
    return element.text ?? "";
  }
  if (element.type === "emoji" && element.name) return `:${element.name}:`;
  if (element.type === "rich_text_list") {
    return (element.elements ?? []).map(richElement).filter((part) =>
      part.length > 0
    ).join("\n");
  }
  if (element.elements?.length) {
    return element.elements.map(richElement).join("");
  }
  return element.text ?? "";
}
