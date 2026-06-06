---
name: overleaf
description: Sync the project with Overleaf — link, pull, push, clone, list, create, compile, or delete projects via the Overleaf MCP server (git bridge or web API). Use to connect a local project to Overleaf, push or pull changes, list projects, or trigger a server-side compile. Triggers on "sync with overleaf", "push to overleaf", "pull from overleaf", "link overleaf project", "overleaf compile".
argument-hint: [link|pull|push|clone|list|new|compile|delete]
---

# overleaf

Drive Overleaf through the bundled MCP server (`mcp__overleaf__*` tools). The
subcommand is the first argument. Two transports exist: the **git bridge**
(robust file sync; needs Overleaf premium or self-hosted) and the **web API**
(project list/create/delete/compile; works on free accounts). Each subcommand
uses whichever transport fits.

**Always call `overleaf_status` first.** It reports which transports are
configured and usable. If neither transport is configured, walk the user
through setup from `${CLAUDE_PLUGIN_ROOT}/docs/OVERLEAF.md` and stop — do not
guess credentials.

Never echo or log secrets (git token, session cookie). Refer to them by name
only.

For long multi-step sync sessions (resolve a conflict, then pull, edit, push,
compile), delegate to the **overleaf-liaison** agent.

---

## 0. Status preflight (every invocation)

Call the MCP tool:

```
overleaf_status
```

Interpret the result:

- **git configured** (`OVERLEAF_GIT_TOKEN` present): `clone`, `pull`, `push`
  are available.
- **web configured** (`OVERLEAF_SESSION_COOKIE` present): `list`, `new`,
  `compile`, `delete`, `link` (web side) are available.
- **neither configured:** present the setup walkthrough (section below) and
  stop.

The `overleaf` block in `.latex-agentic.json` records the current link:

```json
"overleaf": { "projectId": "", "transport": "git" }
```

---

## Setup walkthrough (when nothing is configured)

Point the user at `${CLAUDE_PLUGIN_ROOT}/docs/OVERLEAF.md` and summarize the two
paths. Credentials are supplied via plugin `userConfig` settings **or**
environment variables:

- `OVERLEAF_GIT_TOKEN` — Overleaf git bridge token (Account → Git integration).
  Enables clone/pull/push. Requires premium or a self-hosted instance.
- `OVERLEAF_SESSION_COOKIE` — value of the `overleaf_session2` cookie from a
  logged-in browser session. Enables list/new/compile/delete. Unofficial; may
  need refreshing when it expires.
- `OVERLEAF_BASE_URL` — override for self-hosted Community/Server Pro
  (default `https://www.overleaf.com`).

After the user sets at least one, re-run `overleaf_status` to confirm before
proceeding. Stop here until configuration succeeds.

---

## link

Connect this local project to an Overleaf project and record it in
`.latex-agentic.json`.

1. Determine the target project:
   - If the user named an existing project, call `overleaf_list_projects` (web)
     and match by name to get its `projectId`.
   - If they want a new project, call `overleaf_create_project` and use the
     returned id.
2. Choose the transport: prefer `git` when `OVERLEAF_GIT_TOKEN` is configured
   (best file fidelity); otherwise `web`.
3. Write the link via the MCP tool, which updates the contract's `overleaf`
   block:

   ```
   overleaf_link  projectId=<id>  transport=<git|web>
   ```

4. Confirm by re-reading `.latex-agentic.json` and reporting the linked
   project name + id + transport.

---

## clone (git)

Clone the linked (or named) Overleaf project into a local directory.

1. Resolve `projectId` from `.latex-agentic.json` or the argument.
2. Call:

   ```
   overleaf_clone  projectId=<id>  dir=<target-dir>
   ```

3. Report the cloned path and the main `.tex` detected. Offer to write/refresh
   `.latex-agentic.json` for the new checkout.

---

## pull (git)

Bring remote Overleaf changes into the local working copy.

1. Ensure the project is git-linked.
2. Call:

   ```
   overleaf_pull  dir=<project-dir>
   ```

3. If the pull reports diverging histories or conflicts, see **Conflicts**
   below — do not force anything.
4. Report changed files and suggest a recompile.

---

## push (git)

Commit local changes and push them to Overleaf.

1. Ensure the project is git-linked and there are local changes.
2. Call:

   ```
   overleaf_push  dir=<project-dir>  message="overleaf sync: <short summary>"
   ```

   Use a commit message of the form `overleaf sync: <summary>` describing what
   changed (e.g. `overleaf sync: revise intro and add 3 references`).
3. If the remote has moved on, the push will be rejected — pull/rebase first
   (see **Conflicts**), then push again.
4. Report the pushed commit summary.

---

## list (web)

List the user's Overleaf projects.

```
overleaf_list_projects
```

Render id, name, and last-updated for each. Use this to find an id for `link`,
`compile`, or `delete`.

---

## new (web)

Create a new Overleaf project.

```
overleaf_create_project  name="<project name>"  template=<blank|example>
```

Report the new project's id and name. Offer to `link` the current local
directory to it.

---

## compile (web)

Trigger a server-side compile on Overleaf and report the result.

1. Resolve `projectId` from the contract or argument.
2. Call:

   ```
   overleaf_compile  projectId=<id>
   ```

3. Report the compile status and the tail of the build log. If it failed,
   surface the first error from the log (later errors usually cascade) and
   suggest a local `latexmk -xelatex -interaction=nonstopmode -file-line-error`
   run to debug, or hand off to the **error-doctor** agent.

---

## delete (web) — confirmation required

Trash/delete an Overleaf project. **This is destructive and gated.**

1. Resolve the `projectId` and fetch its name via `overleaf_list_projects` so
   the user can see exactly what will be deleted.
2. Require an explicit typed confirmation from the user (e.g. they type the
   project name or "yes, delete <name>"). Do **not** proceed on an implied or
   one-word "ok".
3. Only after typed confirmation, call with `confirm=true`:

   ```
   overleaf_delete_project  projectId=<id>  confirm=true
   ```

4. Report the outcome. If the user did not provide explicit confirmation, stop
   and ask again — never delete speculatively.

---

## Conflicts

When `pull` or `push` reports divergence, explain (do not auto-resolve
destructively):

1. The local and remote histories diverged because edits happened on both
   sides (e.g. a co-author edited in the Overleaf web editor).
2. Recommended flow — rebase local work on top of remote:

   ```bash
   git -C <project-dir> pull --rebase
   ```

   Resolve any conflicted files, then:

   ```bash
   git -C <project-dir> rebase --continue
   ```

   Then re-run `overleaf push`.
3. If the user is unsure, offer to inspect the conflicting hunks and walk
   through resolution, or delegate the whole session to the **overleaf-liaison**
   agent. Never discard remote work with a force-push without explicit consent.
