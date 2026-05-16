# atlassian-tools

CLI and MCP server for Atlassian Cloud. Manage Confluence pages and Jira issues from your terminal or AI agent — with a single set of credentials.

## Features

- **Confluence** — Pages: search, read, create, update, delete; plus comments, labels, attachments, and child pages
- **Jira** — Issues: search (JQL), view, create (with subtask support), update, transition, delete; plus comments, attachments, issue links, and work logs
- **Shared auth** — One set of credentials (`ATLASSIAN_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_TOKEN`) for all products
- **CLI** — `atlassian` command with product subcommands, interactive confirmations, coloured output
- **MCP server** — Expose all operations as tools for AI agents (Claude Code, etc.)
- **Markdown support** — Automatically converts `.md` files to Confluence storage format
- **Secure by design** — Credentials are read from environment variables only, never written to disk

## Installation

```bash
npm install -g atlassian-tools
```

Or run without installing:

```bash
npx atlassian-tools atlassian confluence auth
```

### Environment variables

```bash
export ATLASSIAN_URL="https://your-instance.atlassian.net"
export ATLASSIAN_EMAIL="you@example.com"
export ATLASSIAN_TOKEN="your-api-token"
```

Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens

> **Migration note:** The legacy `CONFLUENCE_URL`, `CONFLUENCE_EMAIL`, and `CONFLUENCE_TOKEN` variables are still supported. `CONFLUENCE_URL` is expected to include `/wiki` — the tool strips it automatically.

## CLI usage

All write/delete commands prompt for confirmation. Pass `-y` to skip (useful in scripts).

### Confluence

```bash
# Verify connection
atlassian confluence auth

# Spaces
atlassian confluence spaces
atlassian confluence spaces --limit 50

# Read a page
atlassian confluence read 12345678
atlassian confluence read 12345678 --json

# Search pages in a space
atlassian confluence search -s DEV
atlassian confluence search -s DEV -t "Architecture"

# List child pages
atlassian confluence children 12345678

# Create a page (prompts for confirmation)
atlassian confluence create -s DEV -t "New RFC" -f proposal.md
atlassian confluence create -s DEV -t "New RFC" -f proposal.md --parent 87654321
atlassian confluence create -s DEV -t "Draft" -f draft.md --draft

# Update a page
atlassian confluence update 12345678 -f updated.md -m "Revised section 3"
atlassian confluence update 12345678 -t "New Title"

# Delete a page
atlassian confluence delete 12345678

# Comments
atlassian confluence comments 12345678
atlassian confluence comment 12345678 -t "Looks good, approved."

# Labels
atlassian confluence labels 12345678
atlassian confluence add-label 12345678 rfc approved
atlassian confluence remove-label 12345678 rfc

# Attachments
atlassian confluence attachments 12345678
atlassian confluence attach 12345678 /path/to/screenshot.png
atlassian confluence attach 12345678 /path/to/diagram.pdf -c "Architecture diagram v2"
```

### Jira

```bash
# Verify connection
atlassian jira auth

# Projects
atlassian jira projects
atlassian jira projects --limit 50

# Search issues
atlassian jira list --project CARD --status "In Progress"
atlassian jira list --jql 'assignee = currentUser() AND status != Done'
atlassian jira list --type Bug --limit 10

# View an issue
atlassian jira view CARD-42
atlassian jira view CARD-42 --json

# Create an issue (prompts for confirmation)
atlassian jira create --project CARD --type Bug --summary "Fix login"
atlassian jira create --project CARD --type Task --summary "Set up CI" --priority High
# Create a subtask
atlassian jira create --project CARD --type Subtask --summary "Write tests" --parent CARD-42

# Update an issue
atlassian jira update CARD-42 --priority High --summary "Fix login regression"
atlassian jira update CARD-42 --labels "critical,frontend"

# Transition an issue
atlassian jira transition CARD-42 --list          # show available transitions
atlassian jira transition CARD-42 --to "In Progress"

# Delete an issue
atlassian jira delete CARD-42

# Comments
atlassian jira comments CARD-42
atlassian jira comment CARD-42 -t "Blocked on CARD-10, see discussion."

# Issue links
atlassian jira link-types                         # show available link types
atlassian jira links CARD-42                      # list links on an issue
atlassian jira link CARD-42 --type "Blocks" --target CARD-99
atlassian jira link CARD-42 --type "Relates to" --target CARD-7

# Work logs
atlassian jira worklogs CARD-42
atlassian jira log CARD-42 --time "2h 30m"
atlassian jira log CARD-42 --time "1d" --comment "Implemented auth flow"

# Attachments
atlassian jira attachments CARD-42
atlassian jira attach CARD-42 /path/to/screenshot.png
```

## MCP server usage

Add to your Claude Code config (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "atlassian-mcp",
      "env": {
        "ATLASSIAN_URL": "https://your-instance.atlassian.net",
        "ATLASSIAN_EMAIL": "you@example.com",
        "ATLASSIAN_TOKEN": "your-api-token"
      }
    }
  }
}
```

Or without a global install:

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["--package=atlassian-tools", "-y", "atlassian-mcp"],
      "env": {
        "ATLASSIAN_URL": "https://your-instance.atlassian.net",
        "ATLASSIAN_EMAIL": "you@example.com",
        "ATLASSIAN_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Available tools

#### Confluence

| Tool                              | Description                                 | Confirmation needed |
|-----------------------------------|---------------------------------------------|---------------------|
| `confluence_auth`                 | Verify connection                           | No                  |
| `confluence_list_spaces`          | List spaces                                 | No                  |
| `confluence_read_page`            | Read page content by ID                     | No                  |
| `confluence_search_pages`         | Search by space key and title               | No                  |
| `confluence_list_child_pages`     | List child pages of a page                  | No                  |
| `confluence_create_page`          | Create a new page                           | **Yes**             |
| `confluence_update_page`          | Update an existing page                     | **Yes**             |
| `confluence_delete_page`          | Delete a page                               | **Yes**             |
| `confluence_list_comments`        | List comments on a page                     | No                  |
| `confluence_add_comment`          | Add a comment to a page                     | **Yes**             |
| `confluence_list_labels`          | List labels on a page                       | No                  |
| `confluence_add_labels`           | Add labels to a page                        | **Yes**             |
| `confluence_remove_label`         | Remove a label from a page                  | **Yes**             |
| `confluence_list_attachments`     | List attachments on a page                  | No                  |
| `confluence_upload_attachment`    | Upload a file as an attachment to a page    | **Yes**             |

#### Jira

| Tool                              | Description                                 | Confirmation needed |
|-----------------------------------|---------------------------------------------|---------------------|
| `jira_auth`                       | Verify connection                           | No                  |
| `jira_list_projects`              | List projects                               | No                  |
| `jira_get_issue`                  | Get issue details by key                    | No                  |
| `jira_search_issues`              | Search with JQL or filters                  | No                  |
| `jira_create_issue`               | Create a new issue (supports `parentKey` for subtasks) | **Yes** |
| `jira_update_issue`               | Update an existing issue                    | **Yes**             |
| `jira_transition_issue`           | Transition issue status                     | **Yes**             |
| `jira_delete_issue`               | Delete an issue                             | **Yes**             |
| `jira_list_comments`              | List comments on an issue                   | No                  |
| `jira_add_comment`                | Add a comment to an issue                   | **Yes**             |
| `jira_list_link_types`            | List available issue link types             | No                  |
| `jira_list_issue_links`           | List links on an issue                      | No                  |
| `jira_link_issues`                | Link two issues together                    | **Yes**             |
| `jira_remove_issue_link`          | Remove a link between two issues            | **Yes**             |
| `jira_list_worklogs`              | List work log entries on an issue           | No                  |
| `jira_log_work`                   | Log time worked on an issue                 | **Yes**             |
| `jira_list_attachments`           | List attachments on an issue                | No                  |
| `jira_upload_attachment`          | Upload a file as an attachment to an issue  | **Yes**             |

## Project structure

```
src/
├── core/           # Shared: auth, HTTP client, types, markdown converter
│   ├── client.ts   # Generic Atlassian HTTP client (auth, fetch, errors)
│   ├── auth.ts     # Environment-based config loader
│   ├── markdown.ts # Markdown → Confluence storage format converter
│   ├── types.ts    # Shared TypeScript interfaces
│   └── index.ts    # Barrel export
├── confluence/     # Confluence-specific client + types
│   ├── client.ts   # Confluence REST API client
│   ├── types.ts    # Confluence interfaces
│   └── index.ts    # Barrel export
├── jira/           # Jira-specific client + types
│   ├── client.ts   # Jira REST API v3 client
│   ├── helpers.ts  # ADF conversion + JQL builder
│   ├── types.ts    # Jira interfaces
│   └── index.ts    # Barrel export
├── cli/            # Commander.js with product subcommands
│   ├── index.ts    # Main entry point
│   ├── helpers.ts  # Shared CLI utilities
│   ├── confluence.ts
│   └── jira.ts
└── mcp/            # MCP server exposing all tools
    └── index.ts
```

## Programmatic usage

```typescript
import { ConfluenceClient } from "atlassian-tools/confluence";
import { JiraClient } from "atlassian-tools/jira";
import { loadConfigFromEnv } from "atlassian-tools";

const config = loadConfigFromEnv();
const confluence = new ConfluenceClient(config);
const jira = new JiraClient(config);

// Pages
const pages = await confluence.searchPages({ spaceKey: "DEV", title: "RFC" });
const children = await confluence.listChildPages("12345678");

// Comments & labels
await confluence.addComment("12345678", "<p>Approved.</p>");
await confluence.addLabels("12345678", ["approved", "published"]);

// Attachments
await confluence.uploadAttachment({ pageId: "12345678", filePath: "/tmp/diagram.png" });

// Jira issues
const issues = await jira.searchIssues({ project: "CARD", status: "In Progress" });
await jira.addComment("CARD-42", "Blocked on infra, see CARD-10.");
await jira.linkIssues("CARD-42", "Blocks", "CARD-99");
await jira.addWorklog({ issueKey: "CARD-42", timeSpent: "2h", comment: "Auth implementation" });
await jira.uploadAttachment({ issueKey: "CARD-42", filePath: "/tmp/screenshot.png" });
```

## Development

```bash
# Run CLI in dev mode (no build step)
npm run dev:cli -- confluence auth
npm run dev:cli -- jira list --project CARD

# Run MCP server in dev mode
npm run dev:mcp

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT — GeeveeH Software
