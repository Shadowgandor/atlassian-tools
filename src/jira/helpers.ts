import { IssueSearchOptions } from "./types.js";

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

export function buildJql(options: IssueSearchOptions): string {
  if (options.jql) return options.jql;

  const clauses: string[] = [];
  if (options.project) clauses.push(`project = "${options.project}"`);
  if (options.status) clauses.push(`status = "${options.status}"`);
  if (options.assignee) clauses.push(`assignee = "${options.assignee}"`);
  if (options.type) clauses.push(`issuetype = "${options.type}"`);

  return clauses.join(" AND ");
}
