# LaTeX Agentic

A LaTeX development harness for Claude Code. It turns Claude into a working
collaborator for article and resume writers: scaffold a document, write prose in
idiomatic LaTeX, compile with XeLaTeX, doctor errors from the `.log`, curate a
bibliography, polish typesetting, set up multilingual documents, and sync the
whole project with Overleaf — all from inside your editor.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-7c5cff.svg)](https://claude.com/claude-code)
[![XeLaTeX](https://img.shields.io/badge/engine-XeLaTeX-008080.svg)](https://tug.org/xetex/)

## Install

One-liner (adds the marketplace and installs the plugin):

```bash
curl -fsSL https://raw.githubusercontent.com/igorilic/latex-agentic/main/install.sh | bash
```

Manual:

```bash
claude plugin marketplace add igorilic/latex-agentic
claude plugin install latex-agentic@latex-agentic
```

Development mode (run from a local checkout, no install):

```bash
git clone https://github.com/igorilic/latex-agentic
claude --plugin-dir ./latex-agentic
```

The installer is idempotent — re-run it to update an existing install. Use
`--local <path>` to install from a checkout instead of GitHub.

## Quickstart

```text
1. cd ~/writing && claude
2. /new-article          scaffold main.tex, refs.bib, .latexmkrc, Makefile, .latex-agentic.json
3. ...write your prose with Claude...
4. /compile              latexmk -xelatex on the project main file
5. /fix-errors           read the .log, fix the first real error, recompile
6. /bibliography         add citations, fetch by DOI/arXiv, run biber
7. /overleaf             link and sync the project with Overleaf
```

Resumes start from `/new-resume` instead of `/new-article`; everything else is
the same flow.

## Skills

User-invocable slash commands. Each maps to a focused workflow.

| Skill | Purpose |
|---|---|
| `/new-article` | Scaffold an article project (main.tex, refs.bib, .latexmkrc, Makefile, project contract). |
| `/new-resume` | Scaffold a fontspec-designed one-page resume project. |
| `/compile` | Build the project with `latexmk -xelatex` (engine read from the project contract). |
| `/fix-errors` | Parse the `.log`, fix the first real error, recompile until clean. |
| `/bibliography` | Manage BibTeX/biblatex entries, fetch by DOI/arXiv, run biber. |
| `/format` | Run `latexindent` and apply spacing/microtype conventions. |
| `/structure` | Manage sectioning, table of contents, lists, and cross-references. |
| `/i18n` | Set up multilingual typesetting (polyglossia, fonts, RTL/CJK). |
| `/overleaf` | Link, clone, pull, push, and compile via Overleaf. |
| `/clean` | Remove LaTeX build artifacts and auxiliary files. |
| `/wordcount` | Report a word count with `texcount`. |

## Agents

Specialist subagents the main loop delegates to.

| Agent | Purpose |
|---|---|
| `latex-architect` | Document structure and preamble design. |
| `latex-writer` | Prose drafting in idiomatic LaTeX. |
| `error-doctor` | `.log` forensics, reduced to the minimal fix. |
| `bib-curator` | BibTeX/biblatex curation, DOI/arXiv fetch. |
| `typesetter` | Spacing, microtype, and layout polish. |
| `i18n-typesetter` | polyglossia, fonts, and RTL/CJK/Cyrillic setup. |
| `overleaf-liaison` | Drives the Overleaf MCP tools. |
| `resume-coach` | Resume content and one-page discipline. |
| `proofreader` | Prose-level grammar and consistency pass. |

## Hooks

Hooks run automatically in the background; they only ever add context and never
block your work.

- **SessionStart** — detects a LaTeX project in the current folder (a `.tex`
  file or `.latex-agentic.json`) and injects context: the main file, engine,
  bibliography backend, languages, which toolchain binaries are present
  (xelatex/latexmk/chktex/biber), and Overleaf link state.
- **PostToolUse (Write/Edit)** — after a `.tex` edit, runs `chktex` (noisy rules
  suppressed) and surfaces warnings; after a `.bib` edit, checks brace balance
  and duplicate citation keys.
- **PreToolUse (Bash)** — when a command invokes `pdflatex` on a project that
  uses `fontspec`/`polyglossia`/`xeCJK`, emits an advisory nudge toward
  `xelatex`. Advisory only; the command still runs.

## Overleaf

Two transports, used together or independently:

- **Git bridge** — clone/pull/push against
  `https://git.overleaf.com/<projectId>` with basic auth `git:<token>`. Robust
  file sync; requires Overleaf premium or a self-hosted instance.
- **Web API** — list, create, delete, zip-download, and compile projects using a
  browser session cookie. Works on free accounts. This API is **unofficial and
  may break without notice**; it is isolated in a single module so breakage is
  contained.

Configure either through the plugin's `userConfig` prompts or via environment
variables:

| Variable | Meaning |
|---|---|
| `OVERLEAF_BASE_URL` | Overleaf base URL (default `https://www.overleaf.com`; set for self-hosted Community/Server Pro). |
| `OVERLEAF_GIT_TOKEN` | Token from Account Settings -> Git Integration. |
| `OVERLEAF_SESSION_COOKIE` | Value of the `overleaf_session2` browser cookie. |

Full walkthrough — finding your git token and session cookie, and self-hosted
setup — is in [docs/OVERLEAF.md](docs/OVERLEAF.md).

## Internationalization

XeLaTeX with `fontspec` + `polyglossia` is the default, so UTF-8 and
international scripts work out of the box. The `/i18n` skill and the
`i18n-typesetter` agent cover English, German, French, Spanish, Serbian (Latin
and Cyrillic), Russian, Greek, Arabic, Hebrew, Chinese, Japanese, Korean, and
Hindi — including RTL/bidi ordering and CJK via `xeCJK`. See
[docs/INTERNATIONALIZATION.md](docs/INTERNATIONALIZATION.md).

## Requirements

- **TeX Live** with **XeLaTeX** (TeX Live 2023+ recommended).
- **Node.js >= 18** for the zero-dependency Overleaf MCP server.
- **git** for the Overleaf git transport and marketplace install.
- Optional but recommended tools: `latexmk`, `chktex`, `latexindent`, `biber`,
  `texcount`. The installer checks for these and prints per-OS install hints if
  any are missing.

## Uninstall

```bash
claude plugin uninstall latex-agentic@latex-agentic
claude plugin marketplace remove latex-agentic
```

## License

MIT © Igor Ilic. See [LICENSE](LICENSE).
