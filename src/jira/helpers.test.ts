import { describe, it, expect } from "vitest";
import { textToAdf, adfToText, buildJql } from "./helpers.js";

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
