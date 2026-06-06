# Overleaf integration

`latex-agentic` can sync your LaTeX projects with [Overleaf](https://www.overleaf.com)
(and self-hosted Overleaf Community / Server Pro) through an MCP server that
speaks two transports:

- **Git bridge** — the official, stable way to clone/pull/push files.
- **Web API** — an unofficial path (browser session cookie) for listing,
  creating, deleting, downloading, and server-side compiling projects.

You can configure either or both. `overleaf_status` will always tell you, as
plain booleans, which transports are live — without ever printing your secrets.

> **Honest disclaimer.** The **git** transport uses Overleaf's documented Git
> integration and is supported. The **web** transport reuses your browser
> session cookie against undocumented endpoints. It is **unofficial**, may break
> when Overleaf changes its site, and carries no ToS guarantee. **Use it at your
> own risk.** Nothing here scrapes other users' data or bypasses authentication
> — it only acts as *you*, with *your* cookie.

---

## 1. Git transport — get a Git token

This powers `overleaf_clone`, `overleaf_pull`, and `overleaf_push`.

1. Sign in to Overleaf.
2. Open **Account Settings** (top-right menu) → **Git Integration**.
3. Click **Create Token** (Overleaf calls it a "Git authentication token") and
   copy the value. You will only see it once.
4. This is your `OVERLEAF_GIT_TOKEN`.

Notes:

- On **overleaf.com** the Git integration requires a **premium** plan.
- On **self-hosted** Overleaf (Community Edition / Server Pro) the Git bridge is
  **free** once the admin enables it.
- The token is used as the HTTP basic-auth password with username `git`. The
  server feeds it to `git` via an inline credential helper, so it never lands in
  `argv`, `.git/config`, or the stored remote URL.

To find a project's id: open the project in Overleaf and look at the URL —
`https://www.overleaf.com/project/<projectId>`. The `<projectId>` is the
24-character hex string.

---

## 2. Web transport — get the `overleaf_session2` cookie

This powers `overleaf_list_projects`, `overleaf_create_project`,
`overleaf_delete_project`, `overleaf_download_project`, and `overleaf_compile`.

> Unofficial; the cookie expires (often within days) and you'll need to refresh
> it. If you only care about file sync, you can skip this entirely and use the
> git transport.

1. Sign in to Overleaf in your browser.
2. Open **DevTools** (F12 or right-click → Inspect).
3. Go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
4. Expand **Cookies** → select `https://www.overleaf.com` (or your instance).
5. Find the cookie named **`overleaf_session2`** and copy its **Value**.
6. This is your `OVERLEAF_SESSION_COOKIE`.

You can paste either the raw value or the full `overleaf_session2=...` string —
the server normalizes both. When tools start returning `HTTP 401`/`403` or
"redirected to login", the cookie has expired; repeat these steps to refresh it.

---

## 3. Configure the credentials

You have two equivalent options.

### Option A — Plugin userConfig (recommended)

The plugin's `.mcp.json` reads three `userConfig` values and passes them to the
server as `OVERLEAF_CFG_*` env vars:

- `overleaf_base_url`
- `overleaf_git_token`
- `overleaf_session_cookie`

Set them when installing or via plugin settings:

```bash
claude plugin install latex-agentic@latex-agentic
# Claude Code prompts for the userConfig values; leave any blank to skip
# that transport. You can re-run configuration later from plugin settings.
```

Leave `overleaf_base_url` blank to default to `https://www.overleaf.com`.

### Option B — Plain environment variables

If you'd rather not use userConfig, export the variables in your shell profile
(`~/.config/fish/config.fish`, `~/.zshrc`, `~/.bashrc`, …). These take
precedence over the `OVERLEAF_CFG_*` form.

fish:

```fish
set -gx OVERLEAF_BASE_URL "https://www.overleaf.com"
set -gx OVERLEAF_GIT_TOKEN "olp_xxxxxxxxxxxxxxxxxxxx"
set -gx OVERLEAF_SESSION_COOKIE "s%3A....."   # value of overleaf_session2
```

bash/zsh:

```bash
export OVERLEAF_BASE_URL="https://www.overleaf.com"
export OVERLEAF_GIT_TOKEN="olp_xxxxxxxxxxxxxxxxxxxx"
export OVERLEAF_SESSION_COOKIE="s%3A....."     # value of overleaf_session2
```

Empty strings and unsubstituted `${...}` placeholders are treated as **unset**,
so a half-filled config simply disables the transport you didn't set.

---

## 4. Security notes

- **Treat the token and cookie like passwords.** Anyone with them can act as you
  on Overleaf.
- **Never commit them.** Don't put them in `.latex-agentic.json`, the repo, or
  any tracked file. Prefer userConfig (stored by Claude Code) or your shell
  profile. The repo's `.gitignore` already excludes common secret files, but
  the responsibility is yours.
- **The server redacts secrets** from any error text it returns, and logs only
  to stderr — never to tool output. Even so, avoid pasting raw error dumps into
  public issues without a sanity check.
- **Rotate on exposure.** If a token leaks, revoke it under **Account Settings →
  Git Integration**. If a cookie leaks, sign out everywhere to invalidate
  sessions.

---

## 5. Self-hosted Overleaf (Community Edition / Server Pro)

1. Set `OVERLEAF_BASE_URL` to your instance origin, with no trailing slash, e.g.
   `https://latex.example.com`.
2. **Git host:** the server derives it as `<base>/git` for non-`overleaf.com`
   hosts. If your deployment exposes the Git bridge elsewhere, override it with
   `OVERLEAF_GIT_URL`.
3. **Git token:** create it the same way (Account Settings → Git Integration);
   on self-hosted it's free, but the admin must enable the Git bridge
   (`OVERLEAF_GIT_BRIDGE` / Server Pro feature).
4. **Session cookie:** the cookie name is still `overleaf_session2`; copy it from
   DevTools while signed in to *your* instance.

Example (fish):

```fish
set -gx OVERLEAF_BASE_URL "https://latex.example.com"
set -gx OVERLEAF_GIT_TOKEN "olp_selfhostedtoken"
# optional, only if your git bridge isn't at <base>/git:
set -gx OVERLEAF_GIT_URL "https://git.latex.example.com"
```

---

## 6. Which features need which transport

| You want to… | Transport | Tool |
|---|---|---|
| List your projects | web | `overleaf_list_projects` |
| Create a new project | web | `overleaf_create_project` |
| Trash / delete a project | web | `overleaf_delete_project` |
| Download a project as a zip | web | `overleaf_download_project` |
| Trigger a compile + read the log tail | web | `overleaf_compile` |
| Clone a project to edit locally | git | `overleaf_clone` |
| Pull collaborators' changes | git | `overleaf_pull` |
| Push your local edits back | git | `overleaf_push` |
| Record the project link in `.latex-agentic.json` | either | `overleaf_link` |
| Check what's configured | n/a | `overleaf_status` |

Configure **git** for editing sync, **web** for project lifecycle and compile.
Set both for the complete experience. See
[`mcp/overleaf/README.md`](../mcp/overleaf/README.md) for the full tool and
environment reference.
