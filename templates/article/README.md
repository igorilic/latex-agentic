# Article template (XeLaTeX)

A complete, good-looking starting point for a journal- or report-style article.
It is intentionally small but exercises everything a real paper needs:

- `article` class, 11pt, A4
- `polyglossia` for language handling (English by default)
- `fontspec` + `microtype` + `csquotes` for clean typography
- a `booktabs` table and a figure (`example-image` from the `mwe` package)
- a numbered equation referenced with `cleveref`
- an `authoryear` bibliography via `biblatex` + `biber` (`refs.bib`)

## Files

| File | Purpose |
|------|---------|
| `main.tex` | the document |
| `refs.bib` | bibliography database (sample entries — replace them) |
| `.latexmkrc` | XeLaTeX build configuration for `latexmk` |
| `Makefile` | convenience targets (`make pdf`, `make watch`, …) |
| `.latex-agentic.json` | project contract read by the latex-agentic plugin |
| `.gitignore` | ignores LaTeX build artifacts |

## Build

This template is **XeLaTeX-only**. Do not compile with `pdflatex`.

With `latexmk` (recommended — handles the biber pass automatically):

```sh
latexmk -xelatex main        # build main.pdf
latexmk -xelatex -pvc main   # continuous preview, rebuild on save
latexmk -c                   # clean aux files (keep PDF)
latexmk -C                   # clean everything (remove PDF too)
```

Or with `make`:

```sh
make pdf        # build main.pdf
make watch      # continuous preview
make clean      # remove aux files
make distclean  # remove aux files and the PDF
make wordcount  # approximate body word count via texcount
```

## Customizing

- **Fonts:** the template uses the default Latin Modern fonts so it compiles
  anywhere. To use a system font, add e.g. `\setmainfont{EB Garamond}` after
  `\usepackage{fontspec}`.
- **Bibliography:** edit `refs.bib`, cite with `\autocite{key}`, and rebuild.
  `latexmk` reruns `biber` for you.
- **Encoding:** the source is UTF-8. Type accented and non-Latin characters
  directly — never add `inputenc` or `fontenc`.
