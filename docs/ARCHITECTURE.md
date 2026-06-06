# latex-agentic — Architecture

A Claude Code plugin that turns Claude into a full LaTeX development harness for
article and resume writers: scaffolding, compilation, error doctoring,
bibliography management, formatting, internationalization, and Overleaf sync.

## Design principles

1. **XeLaTeX-first.** Every template and workflow defaults to `xelatex` via
   `latexmk -xelatex`. UTF-8 throughout; `fontspec` + `polyglossia` instead of
   `inputenc`/`babel`. `pdflatex` is supported but advisory hooks nudge toward
   XeLaTeX when Unicode/font features are detected.
2. **Zero-install runtime.** The Overleaf MCP server is dependency-free Node
   (≥18) speaking MCP JSON-RPC over stdio by hand. No `npm install` step.
   Hook scripts are POSIX bash with `jq` → `python3` → `node` fallback for JSON.
3. **Dual Overleaf transport.**
   - *Git bridge* (`https://git.overleaf.com/<projectId>`, basic auth
     `git:<token>`) — robust file sync, needs Overleaf premium or self-hosted.
   - *Web API* (session cookie + CSRF) — project list/create/delete/zip
     download/compile, works on free accounts. Unofficial; isolated in one
     module so breakage is contained.
   - `OVERLEAF_BASE_URL` supports self-hosted Community/Server Pro instances.
4. **Project contract.** Each user LaTeX project carries a
   `.latex-agentic.json`:
   ```json
   {
     "main": "main.tex",
     "engine": "xelatex",
     "bib": { "backend": "biber", "files": ["refs.bib"], "style": "authoryear" },
     "languages": ["english"],
     "overleaf": { "projectId": "", "transport": "git" }
   }
   ```
   Skills, agents, and hooks read this file; scaffolding skills write it.
5. **Repo is its own marketplace.** `.claude-plugin/marketplace.json` with
   `source: "./"` so `claude plugin marketplace add igorilic/latex-agentic`
   just works.

## File tree

```
latex-agentic/
├── .claude-plugin/
│   ├── plugin.json            # manifest
│   └── marketplace.json       # repo doubles as marketplace
├── agents/                    # 9 specialist subagents
│   ├── latex-architect.md     # document structure & preamble design
│   ├── latex-writer.md        # prose drafting in idiomatic LaTeX
│   ├── error-doctor.md        # .log forensics → minimal fixes
│   ├── bib-curator.md         # BibTeX/biblatex curation, DOI/arXiv fetch
│   ├── typesetter.md          # spacing, microtype, layout polish
│   ├── i18n-typesetter.md     # polyglossia, fonts, RTL/CJK/Cyrillic
│   ├── overleaf-liaison.md    # drives the Overleaf MCP tools
│   ├── resume-coach.md        # resume content + one-page discipline
│   └── proofreader.md         # prose-level grammar/consistency pass
├── skills/                    # 11 user-invocable skills
│   ├── new-article/SKILL.md
│   ├── new-resume/SKILL.md
│   ├── compile/SKILL.md
│   ├── fix-errors/SKILL.md
│   │   └── references/error-playbook.md   # ~30 common errors → fixes
│   ├── bibliography/SKILL.md
│   ├── format/SKILL.md
│   ├── structure/SKILL.md     # TOC, lists, cross-refs, sectioning
│   ├── i18n/SKILL.md
│   │   └── references/languages.md        # per-language setup recipes
│   ├── overleaf/SKILL.md
│   ├── clean/SKILL.md
│   └── wordcount/SKILL.md
├── hooks/
│   └── hooks.json             # SessionStart, PostToolUse, PreToolUse
├── scripts/
│   ├── lib.sh                 # shared: JSON parsing fallback chain, config read
│   ├── session-context.sh     # SessionStart: detect project, inject context
│   ├── lint-tex.sh            # PostToolUse Write|Edit: chktex on .tex
│   ├── check-bib.sh           # PostToolUse Write|Edit: sanity check .bib
│   └── compile-guard.sh       # PreToolUse Bash: pdflatex+fontspec advisory
├── mcp/overleaf/
│   ├── server.mjs             # zero-dep MCP stdio server
│   └── README.md              # auth setup (token, cookie), tool reference
├── .mcp.json                  # wires server.mjs via ${CLAUDE_PLUGIN_ROOT}
├── templates/
│   ├── article/               # main.tex, refs.bib, .latexmkrc, Makefile,
│   │                          # .latex-agentic.json, .gitignore, README.md
│   ├── resume/                # resume.tex (fontspec design), same scaffolding
│   └── multilingual/          # polyglossia demo: EN + SR (Cyrillic/Latin),
│                              # AR (RTL/bidi), zh (xeCJK), same scaffolding
├── docs/
│   ├── ARCHITECTURE.md        # this file
│   ├── OVERLEAF.md            # auth walkthrough: git token, session cookie
│   └── INTERNATIONALIZATION.md
├── install.sh                 # curl-able installer: deps check + plugin add
├── README.md
├── LICENSE                    # MIT
└── .gitignore
```

## Component contracts

### Agents (`agents/*.md`)
Frontmatter: `name`, `description` (must contain "Use when/for ..." trigger
language so the main loop delegates correctly), optional `tools`. Body: role,
operating procedure, hard rules, output format. Agents never invent package
names; they verify with `kpsewhich`. Error-doctor follows: read `.log` →
identify FIRST error (later ones cascade) → minimal fix → recompile.

### Skills (`skills/*/SKILL.md`)
Frontmatter: `name`, `description` (with trigger phrases). Body: step-by-step
procedure. Skills referencing plugin assets use `${CLAUDE_PLUGIN_ROOT}` (e.g.
`cp -R "${CLAUDE_PLUGIN_ROOT}/templates/article/." .`). Compile skill canonical
command:
```
latexmk -xelatex -interaction=nonstopmode -file-line-error -halt-on-error <main>
```
(engine read from `.latex-agentic.json`, falling back to xelatex).

### Hooks (`hooks/hooks.json` + `scripts/`)
- **SessionStart** → `session-context.sh`: if cwd has `.tex` or
  `.latex-agentic.json`, emit `additionalContext` describing main file, engine,
  bib backend, languages, available toolchain (xelatex/latexmk/chktex/biber
  presence), and Overleaf link state.
- **PostToolUse** (matcher `Write|Edit`) → `lint-tex.sh`: if edited file is
  `.tex` and `chktex` exists, run `chktex -q` (noisy rules suppressed), emit
  warnings as `additionalContext`. `check-bib.sh`: if `.bib`, brace-balance +
  duplicate-key check.
- **PreToolUse** (matcher `Bash`) → `compile-guard.sh`: if command invokes
  `pdflatex` on a project whose files use `fontspec`/`polyglossia`/`xeCJK`,
  emit advisory context recommending xelatex. Never deny; advisory only.
- All hook scripts: exit 0 always (never block), 10s timeout budget, parse
  stdin JSON via `scripts/lib.sh` helper (jq → python3 → node fallback).

### Overleaf MCP server (`mcp/overleaf/server.mjs`)
Zero-dependency Node ESM. Implements MCP protocol methods: `initialize`,
`notifications/initialized`, `ping`, `tools/list`, `tools/call`.
Env: `OVERLEAF_BASE_URL` (default `https://www.overleaf.com`),
`OVERLEAF_GIT_TOKEN`, `OVERLEAF_SESSION_COOKIE` (value of `overleaf_session2`).
Tools (all return `{content: [{type:"text", ...}]}`, errors as `isError`):

| Tool | Transport | Purpose |
|---|---|---|
| `overleaf_status` | both | report which transports are configured/usable |
| `overleaf_list_projects` | web | list projects (id, name, lastUpdated) |
| `overleaf_create_project` | web | create blank/example project, return id |
| `overleaf_delete_project` | web | trash/delete a project (confirm-gated) |
| `overleaf_download_project` | web | zip download → extract into local dir |
| `overleaf_compile` | web | trigger server-side compile, return status+log tail |
| `overleaf_clone` | git | clone project into local dir |
| `overleaf_pull` | git | pull remote changes |
| `overleaf_push` | git | commit local changes + push |
| `overleaf_link` | both | write `.latex-agentic.json` overleaf block |

Web calls: GET login/project page → scrape CSRF (`window.csrfToken` or meta
tag) → send with `x-csrf-token` header + session cookie. Git calls: spawn
`git` with `https://git:${TOKEN}@host/...` (token never logged). Zip extract
via `unzip` child process.

### Installer (`install.sh`)
1. Check `claude` CLI present (else print install pointer and exit 1).
2. Check Node ≥18, git; warn (not fail) on missing TeX tools with per-OS hints
   (macOS: `brew install --cask mactex` or `basictex` + tlmgr list; Debian:
   `texlive-xetex texlive-latex-extra latexmk chktex biber`).
3. `claude plugin marketplace add igorilic/latex-agentic` then
   `claude plugin install latex-agentic@latex-agentic`.
4. Print Overleaf auth setup pointer (docs/OVERLEAF.md) and quickstart.
Idempotent; `--local <path>` flag installs from a checkout instead of GitHub.

## Internationalization policy

Templates and the i18n skill standardize on: `polyglossia` for language
switching, `fontspec` with Noto families as default fallbacks (Noto Serif,
Noto Sans Arabic, Noto Serif CJK), `bidi`-aware ordering rules (polyglossia
loads bidi last — document this trap), `xeCJK` for Chinese/Japanese/Korean.
Language recipes covered in `skills/i18n/references/languages.md`: at minimum
English, German, French, Spanish, Serbian (Latin + Cyrillic), Russian, Greek,
Arabic, Hebrew, Chinese, Japanese, Korean, Hindi.

## Versioning & release

Semver, starting `0.1.0`. Tag releases `latex-agentic--v<version>` (the
`claude plugin tag` convention). Conventional Commits.
