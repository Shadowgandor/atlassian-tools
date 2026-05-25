import { DescriptionFormat, IssueSearchOptions } from "./types.js";

// ── Internal ADF node types ─────────────────────────────────────────────────

type AdfMark = { type: string; attrs?: Record<string, unknown> };
type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: AdfMark[];
  content?: AdfNode[];
};

// ── Plain-text to ADF ───────────────────────────────────────────────────────

export function textToAdf(text: string): unknown {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  };
}

// ── ADF to plain text ───────────────────────────────────────────────────────

export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== "object") return "";
  const doc = adf as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return "";
  return doc.content
    .map((block) =>
      (block.content ?? []).map((inline) => inline.text ?? "").join(""),
    )
    .join("\n\n");
}

// ── Markdown inline parser ──────────────────────────────────────────────────

function parseInline(text: string): AdfNode[] {
  const nodes: AdfNode[] = [];
  let i = 0;
  let plain = "";

  const flushPlain = () => {
    if (plain) {
      nodes.push({ type: "text", text: plain });
      plain = "";
    }
  };

  while (i < text.length) {
    const ch = text[i];

    // Hard break: backslash before newline
    if (ch === "\\" && text[i + 1] === "\n") {
      flushPlain();
      nodes.push({ type: "hardBreak" });
      i += 2;
      continue;
    }

    // Bold+italic: ***...*** or ___...___
    if (text.startsWith("***", i) || text.startsWith("___", i)) {
      const delim = text.slice(i, i + 3);
      const end = text.indexOf(delim, i + 3);
      if (end !== -1) {
        flushPlain();
        nodes.push({
          type: "text",
          text: text.slice(i + 3, end),
          marks: [{ type: "strong" }, { type: "em" }],
        });
        i = end + 3;
        continue;
      }
    }

    // Bold: **...** or __...__
    if (
      (text.startsWith("**", i) && text[i + 2] !== "*") ||
      (text.startsWith("__", i) && text[i + 2] !== "_")
    ) {
      const delim = text.slice(i, i + 2);
      const end = text.indexOf(delim, i + 2);
      if (end !== -1) {
        flushPlain();
        nodes.push({
          type: "text",
          text: text.slice(i + 2, end),
          marks: [{ type: "strong" }],
        });
        i = end + 2;
        continue;
      }
    }

    // Italic: *...* or _..._
    if (
      (ch === "*" && text[i + 1] !== "*") ||
      (ch === "_" && text[i + 1] !== "_")
    ) {
      const end = text.indexOf(ch, i + 1);
      if (end !== -1) {
        flushPlain();
        nodes.push({
          type: "text",
          text: text.slice(i + 1, end),
          marks: [{ type: "em" }],
        });
        i = end + 1;
        continue;
      }
    }

    // Inline code: `...`
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flushPlain();
        nodes.push({
          type: "text",
          text: text.slice(i + 1, end),
          marks: [{ type: "code" }],
        });
        i = end + 1;
        continue;
      }
    }

    // Link: [text](url)
    if (ch === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flushPlain();
          const linkText = text.slice(i + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen);
          nodes.push({
            type: "text",
            text: linkText,
            marks: [{ type: "link", attrs: { href } }],
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    plain += ch;
    i++;
  }

  flushPlain();
  return nodes;
}

// ── Markdown to ADF ─────────────────────────────────────────────────────────

export function markdownToAdf(markdown: string): unknown {
  const lines = markdown.split("\n");
  const content: AdfNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "plain";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Horizontal rule (--- *** ___ with 3+ repeated chars)
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      content.push({ type: "rule" });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*+]\s/.test(line)) {
      const listItems: AdfNode[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[-*+]\s+/, "");
        listItems.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: listItems });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: AdfNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s+/, "");
        listItems.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      content.push({ type: "orderedList", content: listItems });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: parseInline(quoteLines.join(" ")) }],
      });
      continue;
    }

    // Paragraph: collect until blank line or next block-level element
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("> ") &&
      !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      content.push({
        type: "paragraph",
        content: parseInline(paraLines.join(" ")),
      });
    }
  }

  return { type: "doc", version: 1, content };
}

// ── ADF validation ──────────────────────────────────────────────────────────

export function validateAdf(adf: unknown): { valid: boolean; error?: string } {
  if (!adf || typeof adf !== "object" || Array.isArray(adf)) {
    return { valid: false, error: "ADF must be a non-null object" };
  }
  const doc = adf as Record<string, unknown>;
  if (doc.type !== "doc") {
    return { valid: false, error: `Root node type must be "doc", got "${doc.type}"` };
  }
  if (doc.version !== 1) {
    return { valid: false, error: `ADF version must be 1, got ${JSON.stringify(doc.version)}` };
  }
  if (!Array.isArray(doc.content)) {
    return { valid: false, error: "ADF content must be an array of block nodes" };
  }
  return { valid: true };
}

// ── Description format dispatcher ──────────────────────────────────────────

export function descriptionToAdf(text: string, format: DescriptionFormat = "plain"): unknown {
  if (format === "adf") return JSON.parse(text);
  if (format === "markdown") return markdownToAdf(text);
  return textToAdf(text);
}

// ── JQL builder ─────────────────────────────────────────────────────────────

export function buildJql(options: IssueSearchOptions): string {
  if (options.jql) return options.jql;

  const clauses: string[] = [];
  if (options.project) clauses.push(`project = "${options.project}"`);
  if (options.status) clauses.push(`status = "${options.status}"`);
  if (options.assignee) clauses.push(`assignee = "${options.assignee}"`);
  if (options.type) clauses.push(`issuetype = "${options.type}"`);

  return clauses.join(" AND ");
}
