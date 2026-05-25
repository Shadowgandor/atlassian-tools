import { describe, it, expect } from "vitest";
import { textToAdf, adfToText, buildJql, markdownToAdf, validateAdf, descriptionToAdf } from "./helpers.js";

describe("textToAdf", () => {
  it("converts a single paragraph", () => {
    const result = textToAdf("Hello world") as any;
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("paragraph");
    expect(result.content[0].content[0].text).toBe("Hello world");
  });

  it("splits on double newlines into multiple paragraphs", () => {
    const result = textToAdf("First\n\nSecond\n\nThird") as any;
    expect(result.content).toHaveLength(3);
    expect(result.content[0].content[0].text).toBe("First");
    expect(result.content[1].content[0].text).toBe("Second");
    expect(result.content[2].content[0].text).toBe("Third");
  });

  it("preserves single newlines within a paragraph", () => {
    const result = textToAdf("Line one\nLine two") as any;
    expect(result.content).toHaveLength(1);
    expect(result.content[0].content[0].text).toBe("Line one\nLine two");
  });
});

describe("adfToText", () => {
  it("extracts text from ADF document", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
      ],
    };
    expect(adfToText(adf)).toBe("Hello\n\nWorld");
  });

  it("concatenates inline nodes within a block", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "World" },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Hello World");
  });

  it("returns empty string for null/undefined", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
  });

  it("returns empty string for non-object", () => {
    expect(adfToText("string")).toBe("");
    expect(adfToText(42)).toBe("");
  });

  it("returns empty string for object without content", () => {
    expect(adfToText({ type: "doc" })).toBe("");
  });

  it("handles blocks without content arrays", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{ type: "rule" }],
    };
    expect(adfToText(adf)).toBe("");
  });

  it("roundtrips with textToAdf", () => {
    const original = "First paragraph\n\nSecond paragraph";
    const adf = textToAdf(original);
    expect(adfToText(adf)).toBe(original);
  });
});

describe("markdownToAdf", () => {
  it("converts a heading", () => {
    const result = markdownToAdf("# Hello") as any;
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("heading");
    expect(result.content[0].attrs.level).toBe(1);
    expect(result.content[0].content[0].text).toBe("Hello");
  });

  it("converts h2 and h3 headings", () => {
    const result = markdownToAdf("## Section\n### Subsection") as any;
    expect(result.content[0].attrs.level).toBe(2);
    expect(result.content[1].attrs.level).toBe(3);
  });

  it("converts a bullet list", () => {
    const result = markdownToAdf("- Alpha\n- Beta\n- Gamma") as any;
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("bulletList");
    expect(result.content[0].content).toHaveLength(3);
    expect(result.content[0].content[0].type).toBe("listItem");
    expect(result.content[0].content[0].content[0].content[0].text).toBe("Alpha");
  });

  it("converts an ordered list", () => {
    const result = markdownToAdf("1. First\n2. Second") as any;
    expect(result.content[0].type).toBe("orderedList");
    expect(result.content[0].content).toHaveLength(2);
    expect(result.content[0].content[1].content[0].content[0].text).toBe("Second");
  });

  it("converts a fenced code block", () => {
    const result = markdownToAdf("```typescript\nconst x = 1;\n```") as any;
    expect(result.content[0].type).toBe("codeBlock");
    expect(result.content[0].attrs.language).toBe("typescript");
    expect(result.content[0].content[0].text).toBe("const x = 1;");
  });

  it("converts a fenced code block without language", () => {
    const result = markdownToAdf("```\nsome code\n```") as any;
    expect(result.content[0].type).toBe("codeBlock");
    expect(result.content[0].attrs.language).toBe("plain");
  });

  it("converts a blockquote", () => {
    const result = markdownToAdf("> This is a quote") as any;
    expect(result.content[0].type).toBe("blockquote");
    expect(result.content[0].content[0].content[0].text).toBe("This is a quote");
  });

  it("converts a horizontal rule", () => {
    const result = markdownToAdf("---") as any;
    expect(result.content[0].type).toBe("rule");
  });

  it("converts bold inline text", () => {
    const result = markdownToAdf("Hello **world**!") as any;
    const para = result.content[0];
    expect(para.type).toBe("paragraph");
    const nodes = para.content;
    const boldNode = nodes.find((n: any) => n.marks?.some((m: any) => m.type === "strong"));
    expect(boldNode).toBeDefined();
    expect(boldNode.text).toBe("world");
  });

  it("converts italic inline text", () => {
    const result = markdownToAdf("Hello *world*!") as any;
    const nodes = result.content[0].content;
    const italicNode = nodes.find((n: any) => n.marks?.some((m: any) => m.type === "em"));
    expect(italicNode).toBeDefined();
    expect(italicNode.text).toBe("world");
  });

  it("converts inline code", () => {
    const result = markdownToAdf("Use `npm install` to install") as any;
    const nodes = result.content[0].content;
    const codeNode = nodes.find((n: any) => n.marks?.some((m: any) => m.type === "code"));
    expect(codeNode).toBeDefined();
    expect(codeNode.text).toBe("npm install");
  });

  it("converts inline link", () => {
    const result = markdownToAdf("[Jira](https://jira.example.com)") as any;
    const nodes = result.content[0].content;
    const linkNode = nodes.find((n: any) => n.marks?.some((m: any) => m.type === "link"));
    expect(linkNode).toBeDefined();
    expect(linkNode.text).toBe("Jira");
    expect(linkNode.marks[0].attrs.href).toBe("https://jira.example.com");
  });

  it("converts a mixed document", () => {
    const md = "# Title\n\nSome **bold** text.\n\n- Item 1\n- Item 2";
    const result = markdownToAdf(md) as any;
    expect(result.content[0].type).toBe("heading");
    expect(result.content[1].type).toBe("paragraph");
    expect(result.content[2].type).toBe("bulletList");
  });

  it("produces a valid doc envelope", () => {
    const result = markdownToAdf("Hello") as any;
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
    expect(Array.isArray(result.content)).toBe(true);
  });
});

describe("validateAdf", () => {
  it("accepts a valid ADF document", () => {
    const adf = { type: "doc", version: 1, content: [] };
    expect(validateAdf(adf)).toEqual({ valid: true });
  });

  it("rejects null", () => {
    const r = validateAdf(null);
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
  });

  it("rejects non-objects", () => {
    expect(validateAdf("string").valid).toBe(false);
    expect(validateAdf(42).valid).toBe(false);
  });

  it("rejects arrays", () => {
    expect(validateAdf([]).valid).toBe(false);
  });

  it("rejects wrong root type", () => {
    const r = validateAdf({ type: "paragraph", version: 1, content: [] });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/doc/);
  });

  it("rejects wrong version", () => {
    const r = validateAdf({ type: "doc", version: 2, content: [] });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/version/);
  });

  it("rejects missing content array", () => {
    const r = validateAdf({ type: "doc", version: 1, content: "not-array" });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/content/);
  });

  it("accepts a full ADF document with content", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    expect(validateAdf(adf)).toEqual({ valid: true });
  });
});

describe("descriptionToAdf", () => {
  it("defaults to plain format", () => {
    const result = descriptionToAdf("Hello") as any;
    expect(result.type).toBe("doc");
    expect(result.content[0].type).toBe("paragraph");
    expect(result.content[0].content[0].text).toBe("Hello");
  });

  it("uses plain format explicitly", () => {
    const result = descriptionToAdf("Hello\n\nWorld", "plain") as any;
    expect(result.content).toHaveLength(2);
  });

  it("uses markdown format to parse headings", () => {
    const result = descriptionToAdf("# Title\n\nParagraph", "markdown") as any;
    expect(result.content[0].type).toBe("heading");
    expect(result.content[1].type).toBe("paragraph");
  });

  it("uses adf format to pass through JSON", () => {
    const adf = { type: "doc", version: 1, content: [] };
    const result = descriptionToAdf(JSON.stringify(adf), "adf") as any;
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
  });

  it("throws on invalid JSON in adf format", () => {
    expect(() => descriptionToAdf("not json", "adf")).toThrow();
  });
});

describe("buildJql", () => {
  it("returns raw JQL when provided", () => {
    expect(buildJql({ jql: "assignee = currentUser()" })).toBe(
      "assignee = currentUser()",
    );
  });

  it("ignores other filters when raw JQL is provided", () => {
    expect(
      buildJql({ jql: "custom query", project: "CARD", status: "Done" }),
    ).toBe("custom query");
  });

  it("builds JQL from project filter", () => {
    expect(buildJql({ project: "CARD" })).toBe('project = "CARD"');
  });

  it("builds JQL from status filter", () => {
    expect(buildJql({ status: "In Progress" })).toBe('status = "In Progress"');
  });

  it("builds JQL from type filter", () => {
    expect(buildJql({ type: "Bug" })).toBe('issuetype = "Bug"');
  });

  it("builds JQL from assignee filter", () => {
    expect(buildJql({ assignee: "john" })).toBe('assignee = "john"');
  });

  it("combines multiple filters with AND", () => {
    const result = buildJql({ project: "CARD", status: "Done", type: "Bug" });
    expect(result).toBe(
      'project = "CARD" AND status = "Done" AND issuetype = "Bug"',
    );
  });

  it("returns empty string when no filters are set", () => {
    expect(buildJql({})).toBe("");
  });
});
