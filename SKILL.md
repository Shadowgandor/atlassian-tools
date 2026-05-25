# Atlassian Skill

Interact with Atlassian Cloud products using the `atlassian` CLI tool. Supports Confluence (pages, CQL search, copy, comments, labels, attachments, child pages) and Jira (issues, epics, boards, sprints, user search, comments, attachments, issue links, work logs) with secure token-based authentication.

---

## Skill Description (for triggering)

Use this skill whenever the user wants to interact with Atlassian Confluence or Jira. This includes creating, reading, updating, copying, or deleting Confluence pages, searching content with CQL, managing Jira issues, sprints, boards, or epics, listing spaces or projects, adding comments, uploading attachments, managing labels, linking issues, logging time, or finding users. Triggers include mentions of 'Confluence', 'Jira', 'wiki page', 'Confluence page', 'Confluence space', 'Jira issue', 'Jira ticket', 'sprint', 'epic', 'board', or requests to publish documentation or manage project work. Also use when the user references an Atlassian URL or asks to manage knowledge base content or project issues.

---

## Prerequisites

The `atlassian` CLI must be installed and the following environment variables must be set:

```
ATLASSIAN_URL    — e.g. https://myteam.atlassian.net
ATLASSIAN_EMAIL  — Atlassian account email
ATLASSIAN_TOKEN  — Atlassian API token
```

Legacy `CONFLUENCE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN` are also accepted.

**Never** write these values to any file. **Never** echo or log the token.

If the variables are not set, ask the user to provide them and export them in the current shell session.

To verify the connection:

```bash
atlassian confluence auth
atlassian jira auth
```

---

## Confirmation Protocol

**ALWAYS ask the user for explicit confirmation before any create, update, delete, attach, comment, link, or transition operation.**

Describe what will happen (space, title, changes, issue key) and wait for an affirmative reply before running the command. Use the `-y` flag only if the user has already confirmed.

Read, search, list, and view operations are safe and can be executed immediately.

---

## Confluence Commands

### Verify connection

```bash
atlassian confluence auth
```

### List spaces

```bash
atlassian confluence spaces
atlassian confluence spaces --limit 50
```

### Read a page

```bash
atlassian confluence read <pageId>
atlassian confluence read <pageId> --json
```

### Search pages

```bash
atlassian confluence search -s <SPACE_KEY>
atlassian confluence search -s <SPACE_KEY> -t "Page Title"
atlassian confluence search -s <SPACE_KEY> --limit 10
```

### CQL search (full-text, cross-space)

Prefer CQL when the user wants to search by content, across multiple spaces, by label, or by date. The `search` command only works within a single space by title.

```bash
# Full-text search across all spaces
atlassian confluence cql 'type=page AND text ~ "kubernetes"'

# Filter by label
atlassian confluence cql 'type=page AND label = "approved"'

# Combine space, label, and text
atlassian confluence cql 'type=page AND space.key = "DEV" AND label = "rfc" AND text ~ "auth"'

# Pages modified recently
atlassian confluence cql 'type=page AND lastModified > "2024-01-01" ORDER BY lastModified DESC'

atlassian confluence cql '<query>' --limit 10
```

### List child pages

```bash
atlassian confluence children <pageId>
atlassian confluence children <pageId> --limit 50
```

### List templates

```bash
atlassian confluence templates              # global templates
atlassian confluence templates -s DEV       # space-specific templates
```

### Create a page (requires confirmation)

```bash
# From a file
atlassian confluence create -s <SPACE_KEY> -t "Page Title" -f content.md
atlassian confluence create -s <SPACE_KEY> -t "Page Title" -f content.html --parent <parentId>
atlassian confluence create -s <SPACE_KEY> -t "Page Title" -f content.md --draft

# From a template — use the exact template name from `confluence templates`
atlassian confluence create -s <SPACE_KEY> -t "Q3 Retro" --template "Retrospective"
atlassian confluence create -s <SPACE_KEY> -t "Weekly Sync" --template "Meeting Notes" --parent <parentId>
```

The `-f` flag accepts `.md` files (auto-converted to Confluence format), `.html` files (passed as-is), or inline content. Use `--template` instead of `-f` to start from a template.

### Update a page (requires confirmation)

```bash
atlassian confluence update <pageId> -f updated-content.md
atlassian confluence update <pageId> -t "New Title"
atlassian confluence update <pageId> -f content.md -m "Fixed typos"
```

### Copy a page (requires confirmation)

```bash
# -t sets the title of the copy; -d sets the parent page it will live under
atlassian confluence copy <pageId> -t "Copy of RFC" -d <destinationParentPageId>

# Optionally carry over attachments and/or labels
atlassian confluence copy <pageId> -t "Copy of RFC" -d <destinationParentPageId> --attachments --labels
```

### Delete a page (requires confirmation)

```bash
atlassian confluence delete <pageId>
```

### Comments

```bash
# List comments on a page
atlassian confluence comments <pageId>
atlassian confluence comments <pageId> --limit 50

# Add a comment (requires confirmation)
atlassian confluence comment <pageId> -t "Comment text here"
```

### Labels

```bash
# List labels on a page
atlassian confluence labels <pageId>

# Add one or more labels (requires confirmation)
atlassian confluence add-label <pageId> <label> [<label> ...]

# Remove a label (requires confirmation)
atlassian confluence remove-label <pageId> <label>
```

### Attachments

```bash
# List attachments on a page
atlassian confluence attachments <pageId>

# Upload a file as an attachment (requires confirmation)
atlassian confluence attach <pageId> <file>
atlassian confluence attach <pageId> <file> -c "Optional comment"
```

Supported file types include PNG, JPEG, GIF, WebP, SVG, PDF, ZIP, CSV, JSON, XML, HTML, Markdown, and plain text. MIME type is detected automatically from the file extension.

---

## Jira Commands

### Verify connection

```bash
atlassian jira auth
```

### List projects

```bash
atlassian jira projects
atlassian jira projects --limit 50
```

### Search issues

```bash
atlassian jira list --project CARD
atlassian jira list --project CARD --status "In Progress"
atlassian jira list --jql 'assignee = currentUser() AND status != Done'
atlassian jira list --type Bug --limit 10
```

### View an issue

```bash
atlassian jira view CARD-42
atlassian jira view CARD-42 --json
```

### Create an issue (requires confirmation)

```bash
atlassian jira create --project CARD --type Bug --summary "Fix login"
atlassian jira create --project CARD --type Task --summary "Set up CI" --description "Configure GitHub Actions" --priority High
atlassian jira create --project CARD --type Story --summary "User auth" --labels "auth,backend"

# Create a subtask under a parent issue
atlassian jira create --project CARD --type Subtask --summary "Write unit tests" --parent CARD-42
```

#### Description formats for create and update

By default `--description` stores text verbatim as plain paragraphs — markdown tokens like `**bold**` or `# Heading` appear as literal characters in Jira.

Use `--description-format` to control how the description is interpreted:

| Flag | Behaviour |
|------|-----------|
| `--description-format plain` | Default. Text stored verbatim. |
| `--description-format markdown` | Parses headings (`#`–`######`), bullet/ordered lists, fenced code blocks, blockquotes, bold, italic, inline code, and links into native Jira (ADF) nodes. |
| `--description-format adf` | Treats the input as a raw ADF JSON string and passes it directly to the API. |

```bash
# Inline markdown description
atlassian jira create --project CARD --type Task --summary "Refactor auth" \
  --description "## Goals\n\n- Remove legacy middleware\n- Add **OAuth2** support" \
  --description-format markdown

# Load description from a markdown file
atlassian jira create --project CARD --type Story --summary "API redesign" \
  --description-file ./description.md --description-format markdown

# Load a pre-built ADF JSON document
atlassian jira create --project CARD --type Task --summary "Migrate DB" \
  --description-adf-file ./description.adf.json
```

Validate and preview an ADF file before submitting:

```bash
atlassian jira validate-adf ./description.adf.json
```

### Update an issue (requires confirmation)

```bash
atlassian jira update CARD-42 --summary "Fix login regression"
atlassian jira update CARD-42 --priority High --labels "critical,frontend"

# Update description from a markdown file
atlassian jira update CARD-42 --description-file ./updated.md --description-format markdown
```

### Transition an issue (requires confirmation)

```bash
atlassian jira transition CARD-42 --list          # list available transitions
atlassian jira transition CARD-42 --to "In Progress"
atlassian jira transition CARD-42 --to "Done"
```

### Delete an issue (requires confirmation)

```bash
atlassian jira delete CARD-42
```

### User search

Use this to find a user's `accountId` before assigning an issue. The `--assignee` flag on create/update requires an accountId, not a display name.

```bash
atlassian jira users "Jane Smith"
atlassian jira users "jane@example"
atlassian jira users "smith" --limit 20
```

### Epics

```bash
# List all issues belonging to an epic
atlassian jira epic CARD-5
atlassian jira epic CARD-5 --limit 100
```

### Boards & sprints

```bash
# List all boards
atlassian jira boards
atlassian jira boards --limit 50

# List sprints on a board (use board ID from `jira boards`)
atlassian jira sprints <boardId>
atlassian jira sprints <boardId> --state active   # active | future | closed

# Move one or more issues to a sprint (requires confirmation)
# Use sprint ID from `jira sprints`
atlassian jira move-to-sprint <sprintId> <issueKey> [<issueKey> ...]
```

### Comments

```bash
# List comments on an issue
atlassian jira comments CARD-42

# Add a comment (requires confirmation)
atlassian jira comment CARD-42 -t "Blocked on CARD-10, investigating."
```

### Issue links

```bash
# Show available link types (e.g. Blocks, Clones, Relates to)
atlassian jira link-types

# List links on an issue
atlassian jira links CARD-42

# Link two issues (requires confirmation)
# <issueKey> is the outward side; <target> is the inward side
atlassian jira link CARD-42 --type "Blocks" --target CARD-99
atlassian jira link CARD-42 --type "Relates to" --target CARD-7
```

Use `jira link-types` first if you are unsure which link type name to use — link type names are case-sensitive.

### Work logs

```bash
# List work log entries on an issue
atlassian jira worklogs CARD-42

# Log time worked (requires confirmation)
atlassian jira log CARD-42 --time "2h"
atlassian jira log CARD-42 --time "1d 2h 30m" --comment "Implemented auth flow"
atlassian jira log CARD-42 --time "30m" --started "2024-06-01T09:00:00.000+0000"
```

Time format: `Xd Xh Xm` — e.g. `2h`, `30m`, `1d`, `1d 2h 30m`.

### Attachments

```bash
# List attachments on an issue
atlassian jira attachments CARD-42

# Upload a file as an attachment (requires confirmation)
atlassian jira attach CARD-42 /path/to/screenshot.png
```

---

## Error Handling

The CLI exits with a non-zero code and a clear error message on failure:

- **401**: Invalid or expired token — ask the user to check their API token.
- **403**: Insufficient permissions — report the space/project and ask the user to check access.
- **404**: Page, issue, or space not found — confirm the ID or key with the user.
- **409**: Version conflict on update — retry the command (it re-fetches the version automatically).

---

## Tips

- The CLI auto-converts Markdown files to Confluence storage format.
- Use `--json` on `read`/`view` to get raw API output for programmatic use.
- Use `-y` to skip interactive confirmation (only when the user has already confirmed).
- Page/issue URLs are printed after create/update operations.
- Use `--jql` for full JQL query power, or the simpler `--project`/`--status`/`--type` filters.
- `transition --list` shows available workflow transitions before committing to one.
- `link-types` shows available link type names — use the exact name with `link --type`.
- Attachment MIME type is detected automatically from the file extension.
- Use `confluence templates` (or `confluence templates -s <KEY>`) to discover available templates before creating a page with `--template`.
- Use `confluence cql` instead of `confluence search` when searching across spaces or by content body.
- Use `jira users` to look up accountIds before assigning issues — Jira requires accountId, not a display name.
- Use `jira boards` then `jira sprints <boardId>` to get sprint IDs before calling `move-to-sprint`.
- `jira epic <epicKey>` lists all child issues of an epic.
- Jira descriptions default to `plain` format — use `--description-format markdown` when the description contains headings, lists, or inline formatting so they render as native Jira formatting rather than literal characters.
- Use `--description-file` to load a long description from disk instead of passing it inline; combine with `--description-format markdown` for `.md` files.
- Use `--description-adf-file` to pass a pre-built ADF JSON document directly (no format flag needed).
- Run `jira validate-adf <file>` to check an ADF JSON file and preview its plain-text rendering before submitting it to Jira.
