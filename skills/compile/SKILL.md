---
name: compile
description: Compile the current LaTeX project with the canonical latexmk/XeLaTeX build, reading engine and main file from .latex-agentic.json. Reports page count, warning count, and over/underfull box counts on success; on failure extracts only the first error block and hands off to the fix-errors flow. Use when the user says "compile", "build", "build the PDF", "render the document".
---

# compile

Build the project's PDF using the canonical toolchain and report a concise
summary. Do not flood the chat with the full log.

## Procedure

1. **Read the project contract.** From `.latex-agentic.json` in the cwd, read
   `main` and `engine`. Fall back to `main.tex` and `xelatex` when the file or a
   field is missing:
   ```bash
   MAIN=$(jq -r '.main // "main.tex"' .latex-agentic.json 2>/dev/null || echo main.tex)
   ENGINE=$(jq -r '.engine // "xelatex"' .latex-agentic.json 2>/dev/null || echo xelatex)
   ```
   Only `xelatex` and `pdflatex` are expected; map `engine` to the matching
   latexmk flag (`-xelatex` / `-pdf`). Default is `-xelatex`.

2. **Run the canonical compile**, capturing the log for later inspection:
   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN" 2>&1 | tee /tmp/latex-agentic-compile.log
   ```
   (Substitute the engine flag from step 1 if not xelatex.) latexmk handles
   the rerun-for-references and biber passes automatically.

3. **On success**, report a tight summary:
   - **Pages.** Prefer `pdfinfo`:
     ```bash
     pdfinfo "${MAIN%.tex}.pdf" 2>/dev/null | grep -i '^Pages:'
     ```
     If `pdfinfo` is absent, grep the `.log` for the output-pages line:
     ```bash
     grep -o 'Output written on [^ ]* ([0-9]* page' "${MAIN%.tex}.log" | grep -o '[0-9]* page'
     ```
   - **Warnings.** Count `LaTeX Warning` / `Package ... Warning` lines:
     ```bash
     grep -c -E 'Warning' "${MAIN%.tex}.log"
     ```
   - **Over/underfull boxes.** Count separately:
     ```bash
     grep -c 'Overfull \\hbox\|Overfull \\vbox' "${MAIN%.tex}.log"
     grep -c 'Underfull \\hbox\|Underfull \\vbox' "${MAIN%.tex}.log"
     ```
   Present as: PDF path, page count, N warnings, N overfull / N underfull boxes.
   Mention that `/format` can address box warnings if there are many.

4. **On failure**, do **not** dump the whole log. Extract only the first error
   block to show context:
   ```bash
   grep -n -m1 '^!' "${MAIN%.tex}.log"
   grep -n -m1 ':[0-9]*:' "${MAIN%.tex}.log"
   ```
   Show that first error (a few surrounding lines) and immediately hand off to
   the `/fix-errors` flow, which invokes the **error-doctor** agent to isolate
   the first error, consult the error playbook, apply a minimal fix, and
   recompile. Later errors usually cascade from the first, so fix one at a time.
