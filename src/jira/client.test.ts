import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiraClient } from "./client.js";
import { AtlassianClient } from "../core/client.js";

const config = { baseUrl: "https://test.atlassian.net", email: "test@test.com", token: "tok" };

const mockRequest = vi.spyOn(AtlassianClient.prototype, "request");

beforeEach(() => {
  mockRequest.mockReset();
});

describe("JiraClient.listProjects", () => {
  it("calls the project search endpoint with default limit", async () => {
    mockRequest.mockResolvedValueOnce({ values: [] });
    await new JiraClient(config).listProjects();
    expect(mockRequest).toHaveBeenCalledWith("/rest/api/3/project/search?maxResults=25");
  });

  it("returns the values array", async () => {
    const projects = [{ id: "10", key: "PROJ", name: "Project" }];
    mockRequest.mockResolvedValueOnce({ values: projects });
    const result = await new JiraClient(config).listProjects();
    expect(result).toEqual(projects);
  });
});

describe("JiraClient.getIssue", () => {
  it("calls the issue endpoint by key", async () => {
    const issue = { key: "PROJ-1", fields: { summary: "Test", status: { name: "Open" }, issuetype: { name: "Bug" }, priority: null, assignee: null, reporter: null, labels: [], created: "", updated: "", description: null } };
    mockRequest.mockResolvedValueOnce(issue);
    const result = await new JiraClient(config).getIssue("PROJ-1");
    expect(mockRequest).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-1");
    expect(result.key).toBe("PROJ-1");
  });

  it("URL-encodes the issue key", async () => {
    mockRequest.mockResolvedValueOnce({ key: "X", fields: {} });
    await new JiraClient(config).getIssue("PROJ-1");
    expect((mockRequest.mock.calls[0][0] as string)).toContain("PROJ-1");
  });
});

describe("JiraClient.searchIssues", () => {
  it("passes raw JQL when provided", async () => {
    mockRequest.mockResolvedValueOnce({ issues: [] });
    await new JiraClient(config).searchIssues({ jql: "assignee = currentUser()" });
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toContain("assignee+%3D+currentUser%28%29");
  });

  it("builds JQL from filters", async () => {
    mockRequest.mockResolvedValueOnce({ issues: [] });
    await new JiraClient(config).searchIssues({ project: "CARD", status: "Done" });
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toContain("CARD");
    expect(url).toContain("Done");
  });

  it("returns the issues array", async () => {
    const issues = [{ key: "CARD-1", fields: { summary: "Fix bug" } }];
    mockRequest.mockResolvedValueOnce({ issues });
    const result = await new JiraClient(config).searchIssues({ project: "CARD" });
    expect(result).toEqual(issues);
  });
});

describe("JiraClient.createIssue", () => {
  it("posts to the issue endpoint and re-fetches by key", async () => {
    const created = { id: "100", key: "PROJ-99", self: "https://..." };
    const issue = { key: "PROJ-99", fields: { summary: "New", status: { name: "To Do" }, issuetype: { name: "Task" }, priority: null, assignee: null, reporter: null, labels: [], created: "", updated: "", description: null } };

    mockRequest
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(issue);

    const result = await new JiraClient(config).createIssue({
      projectKey: "PROJ",
      issueType: "Task",
      summary: "New",
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const postCall = mockRequest.mock.calls[0];
    expect(postCall[0]).toBe("/rest/api/3/issue");
    expect((postCall[1] as { method: string }).method).toBe("POST");

    const body = JSON.parse((postCall[1] as { body: string }).body);
    expect(body.fields.project.key).toBe("PROJ");
    expect(body.fields.issuetype.name).toBe("Task");
    expect(body.fields.summary).toBe("New");
    expect(result.key).toBe("PROJ-99");
  });

  it("includes parentKey as parent field when provided", async () => {
    mockRequest
      .mockResolvedValueOnce({ id: "1", key: "PROJ-10", self: "" })
      .mockResolvedValueOnce({ key: "PROJ-10", fields: { summary: "Sub", status: { name: "Open" }, issuetype: { name: "Subtask" }, priority: null, assignee: null, reporter: null, labels: [], created: "", updated: "", description: null } });

    await new JiraClient(config).createIssue({ projectKey: "PROJ", issueType: "Subtask", summary: "Sub", parentKey: "PROJ-5" });

    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body.fields.parent).toEqual({ key: "PROJ-5" });
  });
});

describe("JiraClient.updateIssue", () => {
  it("PUTs the issue then re-fetches it", async () => {
    const issue = { key: "PROJ-1", fields: { summary: "Updated", status: { name: "In Progress" }, issuetype: { name: "Task" }, priority: null, assignee: null, reporter: null, labels: [], created: "", updated: "", description: null } };
    mockRequest
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(issue);

    const result = await new JiraClient(config).updateIssue({ issueKey: "PROJ-1", summary: "Updated" });
    expect(mockRequest.mock.calls[0][0]).toBe("/rest/api/3/issue/PROJ-1");
    expect((mockRequest.mock.calls[0][1] as { method: string }).method).toBe("PUT");
    expect(result.fields.summary).toBe("Updated");
  });
});

describe("JiraClient.deleteIssue", () => {
  it("sends DELETE to the issue endpoint", async () => {
    mockRequest.mockResolvedValueOnce(undefined);
    await new JiraClient(config).deleteIssue("PROJ-42");
    expect(mockRequest).toHaveBeenCalledWith(
      "/rest/api/3/issue/PROJ-42",
      { method: "DELETE" },
    );
  });
});

describe("JiraClient.addComment", () => {
  it("posts ADF body to the comment endpoint", async () => {
    mockRequest.mockResolvedValueOnce({ id: "c1", body: {} });
    await new JiraClient(config).addComment("PROJ-5", "Hello team");
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toBe("/rest/api/3/issue/PROJ-5/comment");
    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body.body.type).toBe("doc");
  });
});

describe("JiraClient.listWorklogs", () => {
  it("fetches the worklog endpoint", async () => {
    mockRequest.mockResolvedValueOnce({ worklogs: [] });
    await new JiraClient(config).listWorklogs("PROJ-7");
    expect(mockRequest).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-7/worklog");
  });
});

describe("JiraClient.linkIssues", () => {
  it("posts a link payload to the issueLink endpoint", async () => {
    mockRequest.mockResolvedValueOnce(undefined);
    await new JiraClient(config).linkIssues("PROJ-1", "Blocks", "PROJ-2");
    const body = JSON.parse((mockRequest.mock.calls[0][1] as { body: string }).body);
    expect(body.type.name).toBe("Blocks");
    expect(body.outwardIssue.key).toBe("PROJ-1");
    expect(body.inwardIssue.key).toBe("PROJ-2");
  });
});

describe("JiraClient.searchUsers", () => {
  it("calls the user search endpoint", async () => {
    mockRequest.mockResolvedValueOnce([]);
    await new JiraClient(config).searchUsers("Jane", 5);
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toContain("/rest/api/3/user/search");
    expect(url).toContain("query=Jane");
    expect(url).toContain("maxResults=5");
  });
});

describe("JiraClient.listBoards", () => {
  it("calls the agile boards endpoint", async () => {
    mockRequest.mockResolvedValueOnce({ values: [] });
    await new JiraClient(config).listBoards();
    expect(mockRequest).toHaveBeenCalledWith("/rest/agile/1.0/board?maxResults=25");
  });
});

describe("JiraClient.issueUrl", () => {
  it("builds the browse URL from base and issue key", () => {
    const url = new JiraClient(config).issueUrl("PROJ-42", "https://myteam.atlassian.net");
    expect(url).toBe("https://myteam.atlassian.net/browse/PROJ-42");
  });
});
