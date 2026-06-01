import { readFile } from "fs/promises";
import { basename } from "path";
import { AtlassianClient } from "../core/client.js";
import { AtlassianConfig, PaginatedResponse } from "../core/types.js";
import { attachmentMimeType } from "../core/mime.js";
import {
  ConfluencePage,
  ConfluenceSpace,
  ConfluenceAttachment,
  ConfluenceLabel,
  ConfluenceComment,
  ConfluenceTemplate,
  ConfluenceVersion,
  CQLSearchResult,
  AttachmentUploadInput,
  PageCopyInput,
  PageCreateInput,
  PageUpdateInput,
  PageSearchOptions,
} from "./types.js";

export class ConfluenceClient {
  private readonly http: AtlassianClient;

  constructor(config: AtlassianConfig) {
    this.http = new AtlassianClient(config, "/wiki");
  }

  // ── Authentication check ─────────────────────────────────────────

  async verifyConnection(): Promise<ConfluenceSpace[]> {
    const result = await this.http.request<PaginatedResponse<ConfluenceSpace>>(
      "/api/v2/spaces?limit=5",
    );
    return result.results;
  }

  // ── Spaces ───────────────────────────────────────────────────────

  async listSpaces(limit = 25): Promise<ConfluenceSpace[]> {
    const result = await this.http.request<PaginatedResponse<ConfluenceSpace>>(
      `/api/v2/spaces?limit=${limit}`,
    );
    return result.results;
  }

  async getSpaceByKey(spaceKey: string): Promise<ConfluenceSpace> {
    const result = await this.http.request<PaginatedResponse<ConfluenceSpace>>(
      `/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}`,
    );
    if (result.results.length === 0) {
      const { AtlassianApiError } = await import("../core/types.js");
      throw new AtlassianApiError(404, `Space with key "${spaceKey}" not found`);
    }
    return result.results[0];
  }

  // ── Templates ────────────────────────────────────────────────────

  async listTemplates(spaceKey?: string): Promise<ConfluenceTemplate[]> {
    const params = new URLSearchParams({ expand: "body" });
    if (spaceKey) params.set("spaceKey", spaceKey);
    const result = await this.http.request<{ results: ConfluenceTemplate[] }>(
      `/rest/api/template/page?${params.toString()}`,
    );
    return result.results;
  }

  // ── Read ─────────────────────────────────────────────────────────

  async getPage(pageId: string): Promise<ConfluencePage> {
    return this.http.request<ConfluencePage>(
      `/api/v2/pages/${pageId}?body-format=storage`,
    );
  }

  async listPages(spaceId: string, limit = 25): Promise<ConfluencePage[]> {
    const result = await this.http.request<PaginatedResponse<ConfluencePage>>(
      `/api/v2/spaces/${spaceId}/pages?limit=${limit}`,
    );
    return result.results;
  }

  async searchCQL(cql: string, limit = 25): Promise<CQLSearchResult[]> {
    const params = new URLSearchParams({
      cql,
      limit: String(limit),
      expand: "space,version",
    });
    const result = await this.http.request<{ results: CQLSearchResult[] }>(
      `/rest/api/content/search?${params.toString()}`,
    );
    return result.results;
  }

  async searchPages(options: PageSearchOptions): Promise<ConfluencePage[]> {
    const params = new URLSearchParams({
      spaceKey: options.spaceKey,
      expand: "body.storage,version",
      limit: String(options.limit ?? 25),
    });
    if (options.title) {
      params.set("title", options.title);
    }
    const result = await this.http.request<PaginatedResponse<ConfluencePage>>(
      `/rest/api/content?${params.toString()}`,
    );
    return result.results;
  }

  // ── Create ───────────────────────────────────────────────────────

  async createPage(input: PageCreateInput): Promise<ConfluencePage> {
    const payload: Record<string, unknown> = {
      spaceId: input.spaceId,
      status: input.status ?? "current",
      title: input.title,
      body: {
        representation: "storage",
        value: input.body,
      },
    };
    if (input.parentId) {
      payload.parentId = input.parentId;
    }

    return this.http.request<ConfluencePage>("/api/v2/pages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ── Update ───────────────────────────────────────────────────────

  async updatePage(input: PageUpdateInput): Promise<ConfluencePage> {
    const current = await this.getPage(input.pageId);

    const payload = {
      id: input.pageId,
      status: "current",
      title: input.title ?? current.title,
      body: {
        representation: "storage",
        value: input.body ?? current.body?.storage?.value ?? "",
      },
      version: {
        number: current.version.number + 1,
        message: input.versionMessage ?? "Updated via atlassian-tools",
      },
    };

    return this.http.request<ConfluencePage>(`/api/v2/pages/${input.pageId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // ── Copy ─────────────────────────────────────────────────────────

  async copyPage(input: PageCopyInput): Promise<ConfluencePage> {
    const payload = {
      copyAttachments: input.copyAttachments ?? false,
      copyPermissions: false,
      copyProperties: false,
      copyLabels: input.copyLabels ?? false,
      copyCustomContents: false,
      destination: { type: "parent_page", value: input.destinationPageId },
      pageTitle: input.title,
    };
    return this.http.request<ConfluencePage>(
      `/rest/api/content/${input.pageId}/copy`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  }

  // ── Delete ───────────────────────────────────────────────────────

  async deletePage(pageId: string): Promise<void> {
    await this.http.request<void>(`/api/v2/pages/${pageId}`, {
      method: "DELETE",
    });
  }

  // ── Attachments ───────────────────────────────────────────────────

  async uploadAttachment(input: AttachmentUploadInput): Promise<ConfluenceAttachment> {
    const { pageId, filePath, comment } = input;
    const fileBuffer = await readFile(filePath);
    const fileName = basename(filePath);
    const blob = new Blob([fileBuffer], { type: attachmentMimeType(filePath) });

    const formData = new FormData();
    formData.append("file", blob, fileName);
    if (comment) formData.append("comment", comment);

    const raw = await this.http.request<{
      results: Array<{
        id: string;
        title: string;
        metadata?: { mediaType?: string; comment?: string };
        extensions?: { fileSize?: number; mediaType?: string };
        _links?: { download?: string; webui?: string };
      }>;
    }>(`/rest/api/content/${pageId}/child/attachment`, {
      method: "POST",
      body: formData,
      headers: { "X-Atlassian-Token": "no-check" },
    });

    const att = raw.results[0];
    return {
      id: att.id,
      title: att.title,
      mediaType: att.metadata?.mediaType ?? att.extensions?.mediaType ?? attachmentMimeType(filePath),
      fileSize: att.extensions?.fileSize,
      comment: att.metadata?.comment,
      _links: {
        download: att._links?.download,
        webui: att._links?.webui,
      },
    };
  }

  async listAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    const result = await this.http.request<PaginatedResponse<ConfluenceAttachment>>(
      `/api/v2/pages/${pageId}/attachments`,
    );
    return result.results;
  }

  // ── Comments ─────────────────────────────────────────────────────

  async listComments(pageId: string, limit = 25): Promise<ConfluenceComment[]> {
    const params = new URLSearchParams({
      "body-format": "storage",
      limit: String(limit),
    });
    const result = await this.http.request<{ results: ConfluenceComment[] }>(
      `/api/v2/pages/${pageId}/footer-comments?${params.toString()}`,
    );
    return result.results;
  }

  async addComment(pageId: string, text: string): Promise<ConfluenceComment> {
    const payload = {
      body: { value: text, representation: "storage" },
    };
    return this.http.request<ConfluenceComment>(`/api/v2/pages/${pageId}/footer-comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ── Labels ───────────────────────────────────────────────────────

  async listLabels(pageId: string): Promise<ConfluenceLabel[]> {
    const result = await this.http.request<{ results: ConfluenceLabel[] }>(
      `/api/v2/pages/${pageId}/labels`,
    );
    return result.results;
  }

  async addLabels(pageId: string, labels: string[]): Promise<ConfluenceLabel[]> {
    const payload = labels.map((name) => ({ prefix: "global", name }));
    const result = await this.http.request<{ results: ConfluenceLabel[] }>(
      `/api/v2/pages/${pageId}/labels`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    return result.results;
  }

  async removeLabel(pageId: string, label: string): Promise<void> {
    await this.http.request<void>(
      `/api/v2/pages/${pageId}/labels?name=${encodeURIComponent(label)}`,
      { method: "DELETE" },
    );
  }

  // ── Versions ─────────────────────────────────────────────────────

  async listVersions(pageId: string, limit = 25): Promise<ConfluenceVersion[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    const result = await this.http.request<{ results: ConfluenceVersion[] }>(
      `/api/v2/pages/${pageId}/versions?${params.toString()}`,
    );
    return result.results;
  }

  async getVersion(pageId: string, versionNumber: number): Promise<ConfluenceVersion> {
    return this.http.request<ConfluenceVersion>(
      `/api/v2/pages/${pageId}/versions/${versionNumber}`,
    );
  }

  async restoreVersion(pageId: string, versionNumber: number): Promise<ConfluencePage> {
    const historical = await this.http.request<ConfluencePage>(
      `/api/v2/pages/${pageId}?version-number=${versionNumber}&body-format=storage`,
    );
    const body = historical.body?.storage?.value ?? "";
    return this.updatePage({ pageId, body, title: historical.title, versionMessage: `Restored to version ${versionNumber}` });
  }

  // ── Children ──────────────────────────────────────────────────────

  async listChildPages(pageId: string, limit = 25): Promise<ConfluencePage[]> {
    const result = await this.http.request<PaginatedResponse<ConfluencePage>>(
      `/api/v2/pages/${pageId}/children?limit=${limit}`,
    );
    return result.results;
  }
}
