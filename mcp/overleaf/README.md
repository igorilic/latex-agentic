# Overleaf MCP server

A zero-dependency Node (>=18) MCP server that lets Claude Code drive
[Overleaf](https://www.overleaf.com) — and self-hosted Overleaf Community /
Server Pro instances — over two transports:

- **Git bridge** — robust file sync via the official Git integration
  (`https://git.overleaf.com/<projectId>`, basic auth `git:<token>`). Needs
  Overleaf premium on `overleaf.com`, free on self-hosted.
- **Web API** — project list / create / delete / zip download / server-side
  compile via the session cookie + CSRF token. Works on free accounts.
  **Unofficial** and isolated to this module so breakage stays contained.

It speaks the Model Context Protocol as newline-delimited JSON-RPC 2.0 on
stdio. No `npm install`, no build step. All logging goes to stderr; tokens and
cookies are never logged or returned in tool output.

For the end-to-end auth walkthrough see [`../../docs/OVERLEAF.md`](../../docs/OVERLEAF.md).

## Tools

| Tool | Transport | Args | What it does |
|---|---|---|---|
| `overleaf_status` | both | _(none)_ | Reports which transports are configured (booleans only — never the values), plus the base and git URLs. |
| `overleaf_list_projects` | web | `includeArchived?` | Lists your projects: `id`, `name`, `lastUpdated`, `archived`/`trashed`. Archived/trashed hidden unless `includeArchived:true`. |
| `overleaf_create_project` | web | `name` (required) | Creates a blank project (`POST /project/new`, falls back to `/api/project/new`). Returns project id + URL. |
| `overleaf_delete_project` | web | `projectId`, `confirm` (required), `hard?` | Trashes a project (`POST /project/<id>/trash`). Refuses unless `confirm:true`. With `hard:true` also `DELETE /project/<id>`. |
| `overleaf_download_project` | web | `projectId`, `dir` | Downloads the project zip (`GET /project/<id>/download/zip`), extracts via `unzip` into `dir`, returns the file list. |
| `overleaf_compile` | web | `projectId` | Triggers a server-side compile (`POST /project/<id>/compile`). Reports status and the first/last 30 lines of `output.log` when available. |
| `overleaf_clone` | git | `projectId`, `dir` | Clones the project into `dir` via the git bridge. |
| `overleaf_pull` | git | `dir` | `git pull --rebase` in an existing clone. |
| `overleaf_push` | git | `dir`, `message?` | `git add -A` → commit (skips cleanly when nothing changed) → `git push`. |
| `overleaf_link` | both | `projectId`, `dir`, `transport?` | Merges an `overleaf` block into `<dir>/.latex-agentic.json` (read-modify-write, preserves other keys). |

All tools return `{content:[{type:"text",text}]}`; failures additionally set
`isError:true`. Text payloads for status/list/etc. are JSON for easy parsing.

## Environment variables

The server reads each setting from `OVERLEAF_<KEY>` first, then falls back to
`OVERLEAF_CFG_<KEY>` (the form the plugin's `.mcp.json` injects from
`userConfig`). Empty strings and unsubstituted `${...}` placeholders are
treated as **unset**.

| Variable | Default | Meaning |
|---|---|---|
| `OVERLEAF_BASE_URL` / `OVERLEAF_CFG_BASE_URL` | `https://www.overleaf.com` | Overleaf web origin. Set to your instance for self-hosted. |
| `OVERLEAF_GIT_TOKEN` / `OVERLEAF_CFG_GIT_TOKEN` | _(unset)_ | Git integration token. Enables the **git** transport. |
| `OVERLEAF_SESSION_COOKIE` / `OVERLEAF_CFG_SESSION_COOKIE` | _(unset)_ | Value of the `overleaf_session2` browser cookie. Enables the **web** transport. Accepts the raw value or a full `overleaf_session2=...` string. |
| `OVERLEAF_GIT_URL` | derived | Override the git host. Default: `https://git.overleaf.com` for `overleaf.com`, else `<base>/git`. |

The git token is handed to `git` through an inline credential helper sourced
from the environment, so it never appears in `argv`, `.git/config`, or the
stored remote URL (which is kept credential-free as `<gitHost>/<projectId>`).

## Transport comparison

| Capability | Git transport | Web transport |
|---|---|---|
| Clone / pull / push files | yes | — (download only) |
| List / create / delete projects | — | yes |
| Download project as zip | — | yes |
| Trigger server-side compile | — | yes |
| Stability | official, stable | unofficial, may break |
| Account requirement | premium (overleaf.com) / free (self-hosted) | any account with a valid session cookie |

Use **git** for day-to-day editing sync; use **web** for project lifecycle
operations and to fetch a compiled log. Configure both for the full feature set.

## Troubleshooting

- **`HTTP 401`/`403`, or "redirected to login"** — the `overleaf_session2`
  cookie has expired. Grab a fresh one from your browser (see
  [`docs/OVERLEAF.md`](../../docs/OVERLEAF.md)) and update
  `OVERLEAF_SESSION_COOKIE`.
- **"Could not extract the project list"** — the unofficial web API changed its
  page markup. Fall back to the git transport (`overleaf_clone`), which is
  stable, and please open an issue.
- **`git clone`/`push`/`pull` auth failure** — the git token is missing, wrong,
  or revoked. Regenerate it under **Account Settings → Git Integration** and
  update `OVERLEAF_GIT_TOKEN`. On `overleaf.com` the Git integration requires a
  premium plan.
- **Self-hosted URLs** — set `OVERLEAF_BASE_URL` to your instance origin (no
  trailing slash). The git host defaults to `<base>/git`; override with
  `OVERLEAF_GIT_URL` if your deployment differs.
- **`unzip: command not found`** — `overleaf_download_project` shells out to the
  system `unzip`. Install it (`brew install unzip`, `apt-get install unzip`).
- **Nothing happens / no transports** — run `overleaf_status`. It tells you, as
  booleans, which transports are configured without revealing any secret.
