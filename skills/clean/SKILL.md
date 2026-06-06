---
name: clean
description: Remove LaTeX build artifacts from the project. Default keeps the PDF (latexmk -c plus .bbl/.run.xml/.synctex.gz); with --all also removes the PDF (latexmk -C) after explicit confirmation. Never touches .tex, .bib, or figures. Use when the user says "clean", "clean build", "remove aux files", "clean up the project", "tidy build artifacts".
argument-hint: [--all]
---

# clean

Remove generated build artifacts. Source files are never touched.

## Procedure

1. **Read the project contract** for the main file (so latexmk targets the
   right job). From `.latex-agentic.json`, read `main` (fall back to
   `main.tex`):
   ```bash
   MAIN=$(jq -r '.main // "main.tex"' .latex-agentic.json 2>/dev/null || echo main.tex)
   ```

2. **Choose the mode from the argument.**
   - No argument (default): clean auxiliaries, **keep the PDF**.
   - `--all`: also remove the PDF — but require explicit confirmation first
     (see step 4).

3. **Default clean (keeps PDF).** Run latexmk's auxiliary clean, then remove a
   few extras latexmk does not always sweep:
   ```bash
   latexmk -c "$MAIN"
   rm -f "${MAIN%.tex}.bbl" "${MAIN%.tex}.run.xml" "${MAIN%.tex}.synctex.gz"
   ```
   `latexmk -c` removes `.aux .log .out .toc .fls .fdb_latexmk .bcf` etc. and
   **keeps** the `.pdf`. Report which artifacts were removed.

4. **Full clean (`--all`, removes PDF).** This deletes the compiled PDF, so
   **confirm with the user before proceeding**. Show exactly what will go:
   ```
   --all will run `latexmk -C` and delete the PDF (${MAIN%.tex}.pdf)
   along with all auxiliary files. Source (.tex/.bib/figures) is untouched.
   ```
   Only after the user confirms:
   ```bash
   latexmk -C "$MAIN"
   rm -f "${MAIN%.tex}.run.xml" "${MAIN%.tex}.synctex.gz"
   ```
   `latexmk -C` removes the auxiliaries **and** the PDF.

5. **Safety rules.**
   - Never delete `*.tex`, `*.bib`, or figure files (`*.png`, `*.jpg`,
     `*.pdf` figures in an assets/figures dir, `*.eps`, `*.svg`).
   - Only operate in the current project directory; do not recurse into
     unrelated trees.
   - Report a concise list of what was removed (or "nothing to clean").
