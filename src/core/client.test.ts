import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AtlassianClient } from "./client.js";
import { AtlassianApiError } from "./types.js";

const config = { baseUrl: "https://test.atlassian.net", email: "user@test.com", token: "secret" };

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const bodyText = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(bodyText, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("AtlassianClient.request", () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the Authorization header with Base64-encoded credentials", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await new AtlassianClient(config).request("/test");
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("user@test.com:secret").toString("base64")}`);
  });

  it("sets Content-Type: application/json for JSON requests", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await new AtlassianClient(config).request("/test");
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits Content-Type for FormData bodies so fetch sets multipart boundary", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    const formData = new FormData();
    formData.append("file", new Blob(["data"]), "test.png");
    await new AtlassianClient(config).request("/upload", { method: "POST", body: formData });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("prepends baseUrl and pathPrefix to relative paths", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await new AtlassianClient(config, "/wiki").request("/api/v2/pages");
    expect(mockFetch.mock.calls[0][0]).toBe("https://test.atlassian.net/wiki/api/v2/pages");
  });

  it("uses absolute URLs as-is without prepending baseUrl", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await new AtlassianClient(config).request("https://other.example.com/path");
    expect(mockFetch.mock.calls[0][0]).toBe("https://other.example.com/path");
  });

  it("returns undefined for 204 No Content responses", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await new AtlassianClient(config).request("/delete");
    expect(result).toBeUndefined();
  });

  it("returns parsed JSON body on success", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "42", name: "Test" }));
    const result = await new AtlassianClient(config).request<{ id: string; name: string }>("/resource");
    expect(result).toEqual({ id: "42", name: "Test" });
  });

  it("throws AtlassianApiError with correct status on 4xx", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, { message: "Not Found" }));
    const err = await new AtlassianClient(config).request("/missing").catch((e) => e);
    expect(err).toBeInstanceOf(AtlassianApiError);
    expect((err as AtlassianApiError).statusCode).toBe(404);
  });

  it("throws AtlassianApiError on 401 without retrying", async () => {
    mockFetch.mockImplementation(() => Promise.resolve(makeResponse(401, "Unauthorized")));
    await expect(new AtlassianClient(config).request("/secure")).rejects.toBeInstanceOf(AtlassianApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 up to MAX_RETRIES times", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, "Rate limited"))
      .mockResolvedValueOnce(makeResponse(429, "Rate limited"))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const settled = new AtlassianClient(config).request("/rate-limited").then((v) => v, (e) => e);
    await vi.runAllTimersAsync();
    expect(await settled).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("respects Retry-After header when retrying 429", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, "Rate limited", { "Retry-After": "5" }))
      .mockResolvedValueOnce(makeResponse(200, {}));

    const settled = new AtlassianClient(config).request("/rate-limited").then((v) => v, (e) => e);
    await vi.advanceTimersByTimeAsync(4999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await settled;
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("retries on 503 server errors", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(makeResponse(200, { data: "ok" }));

    const settled = new AtlassianClient(config).request("/flaky").then((v) => v, (e) => e);
    await vi.runAllTimersAsync();
    expect(await settled).toEqual({ data: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws after exhausting all retries on persistent 503", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(() => Promise.resolve(makeResponse(503, "Always down")));

    const settled = new AtlassianClient(config).request("/always-down").then((v) => v, (e) => e);
    await vi.runAllTimersAsync();
    const result = await settled;
    expect(result).toBeInstanceOf(AtlassianApiError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("retries on network errors and succeeds on retry", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(makeResponse(200, { recovered: true }));

    const settled = new AtlassianClient(config).request("/network-error").then((v) => v, (e) => e);
    await vi.runAllTimersAsync();
    expect(await settled).toEqual({ recovered: true });
    vi.useRealTimers();
  });

  it("throws immediately on AbortError (timeout) without retrying", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    await expect(new AtlassianClient(config).request("/slow")).rejects.toThrow(/timed out/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("merges caller-supplied headers with defaults", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await new AtlassianClient(config).request("/test", {
      headers: { "X-Custom-Header": "value" },
    });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Custom-Header"]).toBe("value");
    expect(headers.Authorization).toBeDefined();
  });

  it("caller headers override default Content-Type", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await new AtlassianClient(config).request("/test", {
      headers: { "X-Atlassian-Token": "no-check" },
    });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Atlassian-Token"]).toBe("no-check");
  });
});
