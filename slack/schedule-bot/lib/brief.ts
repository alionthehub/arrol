export const BRIEF_KINDS = [
  "todaybrief",
  "tomorrowbrief",
  "weekbrief",
] as const;

export type BriefKind = (typeof BRIEF_KINDS)[number];

const REF_PHRASE =
  /[*_~]*ref:\s*(?:todaybrief|tomorrowbrief|weekbrief)[*_~]*/gi;
const CLAUDE_FOOTER =
  /[*_~]*sent using[*_~\s]*(?:<@[A-Z0-9]+\|claude>|claude)[*_~]*/gi;

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

function stripNoise(line: string): string {
  REF_PHRASE.lastIndex = 0;
  CLAUDE_FOOTER.lastIndex = 0;
  if (!REF_PHRASE.test(line) && !CLAUDE_FOOTER.test(line)) return line;
  REF_PHRASE.lastIndex = 0;
  CLAUDE_FOOTER.lastIndex = 0;
  return line.replace(REF_PHRASE, "").replace(CLAUDE_FOOTER, "").replace(
    /[ \t]{2,}/g,
    " ",
  ).trim();
}

/**
 * The last todaybrief, tomorrowbrief, or weekbrief token decides the type.
 * The DM is the brief itself: no added header. Ref text and Claude footers
 * are removed wherever they sit, including on a shared line.
 */
export function prepareBrief(raw: string): PreparedBrief | null {
  const tokens = raw.match(/\b(todaybrief|tomorrowbrief|weekbrief)\b/gi);
  if (!tokens?.length) return null;
  const kind = tokens[tokens.length - 1].toLowerCase() as BriefKind;

  const kept: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const cleaned = stripNoise(line);
    if (line.trim() !== "" && cleaned.trim() === "") continue;
    kept.push(cleaned);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();

  const body = kept.join("\n");
  const content = body.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = content[0] ?? "";
  return {
    kind,
    header,
    body,
    message: body,
    notification: content.slice(0, 2).join("\n"),
  };
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
