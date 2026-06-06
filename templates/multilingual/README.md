# Multilingual template (XeLaTeX)

A single, compilable document that demonstrates real internationalization with
`polyglossia`: English, German, French, Serbian (in **both** Latin and
Cyrillic scripts), Russian, Greek, right-to-left **Arabic**, and **Chinese**
(via `xeCJK`). The source is plain UTF-8 — non-Latin text is typed directly.

It is built to **degrade gracefully**: each script uses an
`\IfFontExistsTF` fallback chain, and the Arabic and Chinese sections print a
short "install this font" note instead of breaking the build if no suitable
font is found.

For the full theory — why XeLaTeX + polyglossia over pdfLaTeX + babel, which
fonts ship with TeX Live vs. need installing, and the RTL/CJK traps — see
[`docs/INTERNATIONALIZATION.md`](../../docs/INTERNATIONALIZATION.md). The
`/i18n` skill automates the same setup for a new language.

## Font coverage (quick reference)

| Script | First-choice font | Ships with TeX Live? |
|--------|-------------------|----------------------|
| Latin / Cyrillic / Greek | CMU Serif → FreeSerif → Latin Modern\* | yes (CMU Serif, FreeSerif) |
| Arabic | Amiri → Scheherazade New → Noto Naskh Arabic | yes (Amiri) |
| Chinese | FandolSong → Noto Serif CJK SC → Songti SC | yes (Fandol) |

\* Latin Modern is the always-present last resort but has **no** Cyrillic or
Greek glyphs — which is exactly why the chain tries CMU Serif / FreeSerif
first.

## Files

| File | Purpose |
|------|---------|
| `main.tex` | the multilingual document |
| `.latexmkrc` | XeLaTeX build configuration for `latexmk` |
| `Makefile` | convenience targets (`make pdf`, `make watch`, …) |
| `.latex-agentic.json` | project contract (lists every language used) |
| `.gitignore` | ignores LaTeX build artifacts |

## Build

This template is **XeLaTeX-only**. Do not compile with `pdflatex`.

```sh
latexmk -xelatex main        # build main.pdf
latexmk -xelatex -pvc main   # continuous preview
latexmk -c                   # clean aux files (keep PDF)
latexmk -C                   # clean everything (remove PDF too)
```

Or with `make`: `make pdf`, `make watch`, `make clean`, `make distclean`,
`make wordcount`.

## Getting the best output

Install the optional Noto fonts for the widest, most uniform coverage:

```sh
tlmgr install amiri fandol           # Arabic + Chinese, ships-with-TeX-Live route
# Noto families (better-looking, but a separate install):
tlmgr install noto                   # Noto Serif / Noto Sans
# CJK + Arabic Noto faces are large; on most systems install via the OS:
#   macOS:  fonts are bundled or installable from Font Book
#   Debian: apt install fonts-noto-core fonts-noto-cjk fonts-noto-extra
```
