export interface ConfluencePage {
  id: string;
  title: string;
  status: string;
  spaceId: string;
  version: { number: number; message?: string; createdAt?: string };
  body?: { storage?: { value: string } };
  _links?: { webui?: string; base?: string };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
}

export interface PageCreateInput {
  spaceId: string;
  title: string;
  body: string;
  parentId?: string;
  status?: "current" | "draft";
}

export interface PageUpdateInput {
  pageId: string;
  title?: string;
  body?: string;
  versionMessage?: string;
}

export interface PageSearchOptions {
  spaceKey: string;
  title?: string;
  limit?: number;
}

export interface ConfluenceAttachment {
  id: string;
  title: string;
  mediaType: string;
  fileSize?: number;
  comment?: string;
  _links?: { download?: string; webui?: string; base?: string };
}

export interface AttachmentUploadInput {
  pageId: string;
  filePath: string;
  comment?: string;
}

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix: string;
}

export interface ConfluenceComment {
  id: string;
  body?: { storage?: { value: string } };
  history?: {
    createdDate: string;
    createdBy?: { displayName: string };
  };
}

export interface CQLSearchResult {
  id: string;
  title: string;
  type: string;
  space?: { key: string; name: string };
  version?: { number: number };
  _links?: { webui?: string; base?: string };
}

export interface PageCopyInput {
  pageId: string;
  title: string;
  destinationPageId: string;
  copyAttachments?: boolean;
  copyLabels?: boolean;
}

export interface ConfluenceTemplate {
  templateId: string;
  name: string;
  templateType: string;
  description?: string;
  body?: { storage?: { value: string } };
}
