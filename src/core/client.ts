import { AtlassianConfig, AtlassianApiError } from "./types.js";

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AtlassianClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly pathPrefix: string;

  constructor(config: AtlassianConfig, pathPrefix = "") {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.pathPrefix = pathPrefix;
    const encoded = Buffer.from(`${config.email}:${config.token}`).toString("base64");
    this.authHeader = `Basic ${encoded}`;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl}${this.pathPrefix}${path}`;

    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string> ?? {}),
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timer);
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s: ${url}`);
        }
        // Network error — retry with backoff
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw err;
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES - 1) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000 * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        let errorData: unknown;
        try {
          const text = await response.text();
          try { errorData = JSON.parse(text); } catch { errorData = text; }
        } catch {
          errorData = response.statusText;
        }
        throw new AtlassianApiError(response.status, response.statusText, errorData);
      }

      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    // Unreachable — loop always returns or throws before exhausting retries on success
    throw new Error(`Request failed after ${MAX_RETRIES} attempts: ${url}`);
  }
}
