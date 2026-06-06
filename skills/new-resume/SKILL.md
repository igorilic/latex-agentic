---
name: new-resume
description: Scaffold a new XeLaTeX resume/CV from the plugin template — copies the fontspec resume.tex, substitutes the candidate name, then interviews the user (or ingests an existing resume/LinkedIn text), populates sections via the resume-coach agent, compiles, and enforces the one-page rule. Use when the user wants a new resume or CV, or says "new resume", "build my CV", "start a resume".
argument-hint: [name]
---

# new-resume

Scaffold a fresh XeLaTeX resume in the current directory and populate it with
the user's content. `$1` is the candidate's full name (default: the git user).

## Procedure

1. **Confirm the target directory is empty-ish.** The cwd is the project root.
   ```bash
   if [ -f .latex-agentic.json ] || ls -1 *.tex >/dev/null 2>&1; then
     echo "This directory already contains a LaTeX project (.tex or .latex-agentic.json found)."
   fi
   ```
   If non-empty, stop and ask the user whether to use another directory or
   proceed. Continue only after confirmation.

2. **Copy the resume template** into the current directory (trailing `/.`
   copies contents including dotfiles):
   ```bash
   cp -R "${CLAUDE_PLUGIN_ROOT}/templates/resume/." .
   ```

3. **Resolve the name.** `NAME` = `$1` if provided, else `git config user.name`,
   else ask the user. `resume.tex` ships with the sample name `Jane Doe`; use
   the Edit tool to replace every occurrence of `Jane Doe` with `NAME` (escape
   LaTeX-special characters). The name appears in three places: the `\Huge`
   header line, and the `pdftitle=` / `pdfauthor=` `hyperref` options. Also fill
   the obvious sample contact details (email `jane.doe@example.com`, phone,
   location, and the `github.com/janedoe` / `linkedin.com/in/janedoe` /
   `janedoe.dev` links) if the user supplies them now.

4. **Gather content — two paths.**
   - **Ingest path:** if the user has pasted or pointed to an existing resume,
     CV, or LinkedIn export, parse that text and extract roles, dates,
     highlights, skills, and education.
   - **Interview path:** otherwise, briefly interview the user — keep it short,
     a few targeted questions:
     - Target role / title they are aiming for.
     - Top 3–5 experience highlights (impact, scope, metrics).
     - Key skills and tools.
     - Education / certifications.

5. **Populate sections via the resume-coach agent.** Delegate the drafting to
   the **resume-coach** agent: pass it the target role and the gathered
   material. Apply its guidance to fill the resume sections — it owns
   action-verb phrasing, quantified bullets, reverse-chronological ordering,
   and trimming filler. Insert the returned content into `resume.tex` as valid,
   idiomatic LaTeX (escape special characters in user text).

6. **Write the project contract** `.latex-agentic.json` (update the template's
   copy if present, else create it):
   ```json
   {
     "main": "resume.tex",
     "engine": "xelatex",
     "bib": { "backend": "biber", "files": [], "style": "authoryear" },
     "languages": ["english"],
     "overleaf": { "projectId": "", "transport": "git" }
   }
   ```

7. **Compile.** Read `main` and `engine` from `.latex-agentic.json` (fall back
   to `resume.tex` / `xelatex`) and run the canonical build:
   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error resume.tex
   ```
   On failure, hand off to the `/fix-errors` flow (error-doctor agent) rather
   than dumping the log, then re-verify.

8. **Enforce the one-page rule.** Determine the page count (use `pdfinfo` on the
   PDF if present, else grep the `.log` for `Output written`). If the resume
   exceeds one page, flag it and ask the resume-coach agent to tighten content
   (fewer/shorter bullets, drop stale roles, condense sections) until it fits.
   Always remind the user that a resume should be one page.

9. **Show next steps.** Report the PDF path and point to:
   - `/compile` — rebuild after edits
   - `/format` — spacing and layout polish
   - `/overleaf` — link and sync with Overleaf
