---
name: new-article
description: Scaffold a new XeLaTeX article project from the plugin template — copies main.tex/refs.bib/build files, substitutes title/author/date, sets up the requested language, writes the .latex-agentic.json contract, and verifies with one compile. Use when the user wants to start a new article, paper, or LaTeX document, or says "new article", "start a paper", "scaffold a document".
argument-hint: "[title] [language]"
---

# new-article

Scaffold a fresh XeLaTeX article project in the current directory. `$1` is the
document title, `$2` is the primary language (default `english`). Author
defaults to the git user; date defaults to today.

## Procedure

1. **Confirm the target directory is empty-ish.** The current working
   directory is the project root. Refuse to clobber an existing project:
   ```bash
   if [ -f .latex-agentic.json ] || ls -1 *.tex >/dev/null 2>&1; then
     echo "This directory already contains a LaTeX project (.tex or .latex-agentic.json found)."
   fi
   ```
   If it is non-empty, stop and ask the user whether to pick another directory
   or proceed anyway. Only continue once they confirm. A few stray dotfiles
   (`.git`, `.gitignore`, `README.md`) are fine.

2. **Copy the article template** verbatim into the current directory using the
   plugin root env var (note the trailing `/.` to copy contents including
   dotfiles):
   ```bash
   cp -R "${CLAUDE_PLUGIN_ROOT}/templates/article/." .
   ```

3. **Resolve substitution values.**
   - `TITLE` = `$1` if provided, else ask the user for a title.
   - `AUTHOR` = `git config user.name` if set, else ask the user.
   - `DATE` = `\today` (let LaTeX render it) unless the user wants a fixed date.
   - `LANGUAGE` = `$2` lowercased, else `english`.

4. **Substitute the sample metadata** in the copied template. `main.tex` ships
   with unique sample values that you overwrite with the resolved ones, using
   the Edit tool for exact, reviewable replacements:
   - `\title{A Concise Study of Reproducible Typesetting}` → `\title{TITLE}`
   - `\author{Ada A. Researcher\\\small Department of Document Engineering, Example University}`
     → `\author{AUTHOR}`
   - `\date{\today}` → `\date{DATE}` (leave `\today` if the user wants today's date)
   - The matching `pdftitle={A Concise Study of Reproducible Typesetting}` and
     `pdfauthor={Ada A. Researcher}` lines in the `hyperref` options — update
     these too so the PDF metadata matches.

   Escape any LaTeX-special characters (`& % $ # _ { } ~ ^ \`) in user-supplied
   text before inserting it.

5. **Language setup.** If `LANGUAGE` is not `english`, delegate to the
   **i18n-typesetter** agent: ask it for the polyglossia/fontspec recipe for
   `LANGUAGE` (it consults `skills/i18n/references/languages.md`) and apply the
   returned preamble changes to `main.tex` — set the main language via
   `\setmainlanguage{...}` and load the matching Noto font family. Do not
   hand-roll language config; let the specialist drive it. For `english`, the
   template default needs no changes.

6. **Write the project contract** `.latex-agentic.json`. If the template ships
   one, update it; otherwise create it. Reflect the chosen language:
   ```json
   {
     "main": "main.tex",
     "engine": "xelatex",
     "bib": { "backend": "biber", "files": ["refs.bib"], "style": "authoryear" },
     "languages": ["LANGUAGE"],
     "overleaf": { "projectId": "", "transport": "git" }
   }
   ```
   Replace `LANGUAGE` with the resolved value (and include `english` plus the
   extra language if the document is multilingual).

7. **Verify with one compile.** Read `main` and `engine` from
   `.latex-agentic.json` (fall back to `main.tex` / `xelatex`) and run the
   canonical build:
   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error main.tex
   ```
   On failure, do **not** dump the whole log — hand off to the `/fix-errors`
   flow (error-doctor agent) to isolate and repair the first error, then
   re-verify.

8. **Show next steps.** On a clean compile, report the produced PDF path and
   point the user to the follow-on skills:
   - `/compile` — rebuild after edits
   - `/bibliography` — add and manage citations
   - `/overleaf` — link and sync with Overleaf
