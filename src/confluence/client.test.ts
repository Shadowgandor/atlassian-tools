import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfluenceClient } from "./client.js";
import { AtlassianClient } from "../core/client.js";

const config = { baseUrl: "https://test.atlassian.net", email: "test@test.com", token: "tok" };

const mockRequest = vi.spyOn(AtlassianClient.prototype, "request");

beforeEach(() => {
  mockRequest.mockReset();
});

describe("ConfluenceClient.listSpaces", () => {
  it("calls the spaces endpoint with default limit", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).listSpaces();
    expect(mockRequest).toHaveBeenCalledWith("/api/v2/spaces?limit=25");
  });

  it("respects a custom limit", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).listSpaces(50);
    expect(mockRequest).toHaveBeenCalledWith("/api/v2/spaces?limit=50");
  });

  it("returns the results array", async () => {
    const spaces = [{ id: "1", key: "DEV", name: "Dev", status: "current" }];
    mockRequest.mockResolvedValueOnce({ results: spaces });
    const result = await new ConfluenceClient(config).listSpaces();
    expect(result).toEqual(spaces);
  });
});

describe("ConfluenceClient.getPage", () => {
  it("calls the page endpoint with storage body format", async () => {
    const page = { id: "123", title: "My Page", status: "current", version: { number: 3 }, spaceId: "S1" };
    mockRequest.mockResolvedValueOnce(page);
    const result = await new ConfluenceClient(config).getPage("123");
    expect(mockRequest).toHaveBeenCalledWith("/api/v2/pages/123?body-format=storage");
    expect(result.title).toBe("My Page");
  });
});

describe("ConfluenceClient.searchPages", () => {
  it("includes spaceKey and title in query", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).searchPages({ spaceKey: "DEV", title: "RFC" });
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toContain("spaceKey=DEV");
    expect(url).toContain("title=RFC");
  });

  it("omits title when not provided", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).searchPages({ spaceKey: "DEV" });
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).not.toContain("title=");
  });
});

describe("ConfluenceClient.searchCQL", () => {
  it("encodes the CQL query and passes limit", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).searchCQL('type=page AND label = "rfc"', 10);
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toContain("/rest/api/content/search");
    expect(url).toContain("limit=10");
    expect(url).toContain("type%3Dpage");
  });
});

describe("ConfluenceClient.createPage", () => {
  it("posts to the pages endpoint with correct payload", async () => {
    const page = { id: "999", title: "New Page", status: "current", version: { number: 1 }, spaceId: "S1" };
    mockRequest.mockResolvedValueOnce(page);

    await new ConfluenceClient(config).createPage({
      spaceId: "S1",
      title: "New Page",
      body: "<p>Hello</p>",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v2/pages",
      expect.objectContaining({ method: "POST" }),
    );

    const bodyArg = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(bodyArg.title).toBe("New Page");
    expect(bodyArg.spaceId).toBe("S1");
    expect(bodyArg.body.value).toBe("<p>Hello</p>");
    expect(bodyArg.status).toBe("current");
  });

  it("sets status to draft when requested", async () => {
    mockRequest.mockResolvedValueOnce({ id: "1", title: "Draft", status: "draft", version: { number: 1 }, spaceId: "S1" });
    await new ConfluenceClient(config).createPage({ spaceId: "S1", title: "Draft", body: "", status: "draft" });
    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body.status).toBe("draft");
  });

  it("includes parentId when provided", async () => {
    mockRequest.mockResolvedValueOnce({ id: "1", title: "Child", status: "current", version: { number: 1 }, spaceId: "S1" });
    await new ConfluenceClient(config).createPage({ spaceId: "S1", title: "Child", body: "", parentId: "42" });
    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body.parentId).toBe("42");
  });
});

describe("ConfluenceClient.updatePage", () => {
  it("fetches the current page first then PUTs the updated version", async () => {
    const current = { id: "5", title: "Old", status: "current", version: { number: 2 }, spaceId: "S1", body: { storage: { value: "<p>old</p>" } } };
    mockRequest
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...current, title: "New", version: { number: 3 } });

    await new ConfluenceClient(config).updatePage({ pageId: "5", title: "New" });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const putBody = JSON.parse((mockRequest.mock.calls[1][1] as { body: string }).body);
    expect(putBody.title).toBe("New");
    expect(putBody.version.number).toBe(3);
  });
});

describe("ConfluenceClient.deletePage", () => {
  it("sends DELETE to the page endpoint", async () => {
    mockRequest.mockResolvedValueOnce(undefined);
    await new ConfluenceClient(config).deletePage("77");
    expect(mockRequest).toHaveBeenCalledWith("/api/v2/pages/77", { method: "DELETE" });
  });
});

describe("ConfluenceClient.listChildPages", () => {
  it("calls the children endpoint with limit", async () => {
    mockRequest.mockResolvedValueOnce({ results: [] });
    await new ConfluenceClient(config).listChildPages("10", 15);
    expect(mockRequest).toHaveBeenCalledWith("/api/v2/pages/10/children?limit=15");
  });
});

describe("ConfluenceClient.addLabels", () => {
  it("posts an array of label objects", async () => {
    mockRequest.mockResolvedValueOnce({ results: [{ name: "rfc" }, { name: "approved" }] });
    const result = await new ConfluenceClient(config).addLabels("20", ["rfc", "approved"]);
    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual([
      { prefix: "global", name: "rfc" },
      { prefix: "global", name: "approved" },
    ]);
    expect(result.map((l) => l.name)).toEqual(["rfc", "approved"]);
  });
});

describe("ConfluenceClient.addComment", () => {
  it("posts a storage-format comment body to the v2 footer-comments endpoint", async () => {
    mockRequest.mockResolvedValueOnce({ id: "c1" });
    await new ConfluenceClient(config).addComment("30", "<p>Nice work</p>");
    const [url, opts] = mockRequest.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("/api/v2/pages/30/footer-comments");
    const body = JSON.parse(opts.body);
    expect(body.body.value).toBe("<p>Nice work</p>");
    expect(body.body.representation).toBe("storage");
  });
});
