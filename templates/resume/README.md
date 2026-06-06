# Resume template (XeLaTeX)

A clean, single-page resume built on the stock `article` class — no exotic
document classes, so it compiles on any TeX Live installation. Design notes:

- One tasteful accent colour (one line to change), clear visual hierarchy.
- A sans-serif face with a graceful fallback chain (Source Sans 3 → Lato →
  TeX Gyre Heros → Latin Modern Sans), so it builds whether or not the
  "nice" fonts are installed.
- **ATS-friendly:** real selectable text, standard section names
  (Summary, Experience, Education, Skills, Projects), no tables in the main
  flow, no icon fonts used as content.
- Heavily commented so you can self-edit without knowing much LaTeX.

The content is a placeholder persona — **Jane Doe**, a senior software
engineer. Replace it with your own.

## Files

| File | Purpose |
|------|---------|
| `resume.tex` | the resume |
| `.latexmkrc` | XeLaTeX build configuration for `latexmk` |
| `Makefile` | convenience targets (`make pdf`, `make watch`, …) |
| `.latex-agentic.json` | project contract read by the latex-agentic plugin |
| `.gitignore` | ignores LaTeX build artifacts |

## Build

This template is **XeLaTeX-only**. Do not compile with `pdflatex`.

With `latexmk`:

```sh
latexmk -xelatex resume        # build resume.pdf
latexmk -xelatex -pvc resume   # continuous preview, rebuild on save
latexmk -c                     # clean aux files (keep PDF)
latexmk -C                     # clean everything (remove PDF too)
```

Or with `make`:

```sh
make pdf        # build resume.pdf
make watch      # continuous preview
make clean      # remove aux files
make distclean  # remove aux files and the PDF
make wordcount  # approximate word count via texcount
```

## Editing checklist

1. Replace the header block (name, role, contact line).
2. Overwrite each `\entry{...}` and its bullet `points` with your history.
3. Keep it to **one page** — trim bullets before shrinking fonts.
4. Rebrand by changing one line: `\definecolor{accent}{HTML}{1F6F8B}`.
5. To force a specific font, replace the `\IfFontExistsTF` block with a single
   `\setmainfont{Your Font}`.
