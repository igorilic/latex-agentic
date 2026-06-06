# Internationalization

`latex-agentic` is **XeLaTeX-first** and standardizes on `fontspec` +
`polyglossia` for multilingual typesetting. This document explains why, which
fonts you can rely on, and the practical traps for right-to-left (RTL) and CJK
scripts. The companion template
[`templates/multilingual/`](../templates/multilingual/) is a single compilable
document that demonstrates everything below; the `/i18n` skill automates the
same setup for a new language.

## Why XeLaTeX + polyglossia (not pdfLaTeX + babel)

| Concern | pdfLaTeX + babel | **XeLaTeX + polyglossia** |
|---------|------------------|---------------------------|
| Input encoding | needs `inputenc`; 8-bit font encodings | native UTF-8, no `inputenc` |
| Fonts | `fontenc` + special font packages per script | any system/OpenType font via `fontspec` |
| Non-Latin scripts | one font encoding at a time; awkward | one engine, many fonts, mixed freely |
| RTL (Arabic/Hebrew) | extra packages, fragile | `bidi` integrated through polyglossia |
| CJK | not practical | `xeCJK`, proper line-breaking |
| Type your text | escape codes for accents | type the real characters |

The rule for every template and skill in this plugin:

- **Never** load `inputenc` or `fontenc`. They are pdfLaTeX-era packages and
  fight `fontspec`. Just type UTF-8.
- Load `fontspec` early, `polyglossia` after it, and `hyperref` last.
- Assign a font **per script** — no single font covers Latin, Cyrillic, Greek,
  Arabic, and Chinese at once.

(LuaLaTeX + `babel` + `fontspec` is a valid modern alternative, but this
project commits to XeLaTeX for its mature `bidi`/`xeCJK` story and fast builds.)

## Font coverage per script

The key practical fact: **`\IfFontExistsTF` resolves a font either by family
name (via fontconfig) or by filename (via the TeX tree).** Fonts that ship with
TeX Live are always findable **by filename** even when fontconfig has not
indexed them — which is why the templates' fallback chains test filenames for
the TeX Live faces. Build a robust chain like this:

```latex
\IfFontExistsTF{CMU Serif}{\setmainfont{CMU Serif}}{%
 \IfFontExistsTF{cmunrm.otf}{\setmainfont{CMU Serif}[Extension=.otf,
   UprightFont=cmunrm, BoldFont=cmunbx, ItalicFont=cmunti,
   BoldItalicFont=cmunbi]}{%
 \IfFontExistsTF{FreeSerif}{\setmainfont{FreeSerif}}{%
 \setmainfont{Latin Modern Roman}}}}  % last resort
```

| Script(s) | First-choice font | Ships with TeX Live? | TeX Live filename | If you want better, install |
|-----------|-------------------|----------------------|-------------------|-----------------------------|
| Latin / Cyrillic / Greek | **CMU Serif** (Computer Modern Unicode) | **yes** | `cmunrm.otf` | — |
| Latin / Cyrillic / Greek (wide fallback) | **FreeSerif** (GNU FreeFont) | **yes** | `FreeSerif.otf` | — |
| Latin only (last resort) | Latin Modern Roman | yes (always) | `lmroman10-regular.otf` | — (no Cyrillic/Greek!) |
| Sans (resume) | TeX Gyre Heros | yes | `texgyreheros-regular.otf` | Source Sans 3, Lato |
| Arabic | **Amiri** | **yes** | `Amiri-Regular.ttf` | Scheherazade New; Noto Naskh Arabic (`tlmgr install notonaskharabic` or OS) |
| Chinese (CJK) | **FandolSong** | **yes** | `FandolSong-Regular.otf` | Noto Serif CJK SC; Songti SC (macOS) |
| Many others | Noto families | **no** (separate install) | — | `tlmgr install noto` / OS fonts |

> **The Latin Modern trap.** Latin Modern Roman is the LaTeX default and is
> always present — but it has **no Cyrillic and no Greek** glyphs. If your
> fallback chain ends at Latin Modern, Russian/Greek/Serbian-Cyrillic text will
> show "missing character" boxes. Always put **CMU Serif** or **FreeSerif**
> *ahead* of Latin Modern in the chain. Both ship with TeX Live and cover
> Latin, Cyrillic, and Greek.

### Installing the optional Noto families

Noto gives the most uniform, modern look across scripts, but it is a separate
download:

```sh
# via TeX Live's package manager
tlmgr install noto noto-emoji notonaskharabic
# Noto CJK is large; on most systems install it through the OS instead:
#   macOS:  available in Font Book / bundled with the system
#   Debian/Ubuntu: apt install fonts-noto-core fonts-noto-cjk fonts-noto-extra
```

After an OS font install, run `fc-cache -f` so XeLaTeX can find the new fonts
by family name.

## Right-to-left (Arabic, Hebrew) specifics

- Declare the language with `\setotherlanguage{arabic}` (or `hebrew`), then
  define its font: `\newfontfamily\arabicfont[Script=Arabic]{Amiri-Regular.ttf}`.
  The `Script=Arabic` feature turns on the contextual shaping (letters join and
  change form by position) — without it, Arabic renders as disconnected
  letters.
- **Use the capitalized environment for a full RTL paragraph:**
  `\begin{Arabic} … \end{Arabic}`. The capitalized form switches **both** the
  font and the base text direction. The lower-case `\textarabic{…}` /
  `\arabic` forms are the *inline* commands. Using the wrong one for a block is
  a classic trap: the text silently falls back to the Latin main font (no
  Arabic glyphs) and the run can even blow TeX's input stack.
- **Load order:** polyglossia pulls in the `bidi` package automatically and
  `bidi` must be the last bidi-affecting package loaded. In practice: load
  `fontspec`, then `polyglossia` (with your RTL `\setotherlanguage`), and load
  `hyperref` last. `bidi` then patches `hyperref` for you.

### The `\maketitle` + hyperref + bidi trap

On current TeX Live, the standard `\maketitle` does **not** coexist with
`hyperref` once an RTL language (via `bidi`) is active — the combination
overflows TeX's input stack at `\end{document}`. The fix used in the
multilingual template is to **typeset the title block by hand** instead of
calling `\maketitle`:

```latex
\begin{document}
\begin{center}
  {\LARGE\bfseries My Title}\\[4pt]
  {\large Author Name}\\[2pt]
  {\today}
\end{center}
```

It looks the same, is easier to restyle, and sidesteps the bug entirely.

## CJK (Chinese, Japanese, Korean) specifics

- Load `xeCJK` and set a CJK font: `\setCJKmainfont{FandolSong-Regular.otf}`.
  `xeCJK` handles the hard part — **line-breaking**. CJK text has no spaces
  between words, so breaks must be decided glyph-by-glyph; `xeCJK` does this and
  also manages the spacing where CJK meets Latin.
- Only load `xeCJK` (and call `\setCJKmainfont`) when a CJK font is actually
  available, or `\setCJKmainfont` errors out. The template guards this with an
  `\IfFontExistsTF` chain and a `\newif\ifhascjk` flag, loading `xeCJK` only on
  the true branch.
- For Japanese add `\setCJKmainfont` with a Japanese face (e.g. Noto Serif CJK
  JP) and consider `xeCJK`'s `\xeCJKsetup` punctuation options; for Korean,
  likewise with a Korean face. The same `xeCJK` machinery serves all three.

## Graceful degradation (don't break the build)

A template that may be opened on a machine missing a script font should
**degrade, not fail**. The pattern: detect the font once, store the result in a
boolean, and either typeset the section or print a short "install this font"
note:

```latex
\newif\ifhasarabic
\IfFontExistsTF{Amiri}{\newfontfamily\arabicfont[Script=Arabic]{Amiri}\hasarabictrue}{%
 \IfFontExistsTF{Amiri-Regular.ttf}{\newfontfamily\arabicfont[Script=Arabic]{Amiri-Regular.ttf}\hasarabictrue}{%
 \hasarabicfalse}}
...
\ifhasarabic
  \begin{Arabic}…\end{Arabic}
\else
  \textit{Arabic section skipped: install Amiri (\texttt{tlmgr install amiri}).}
\fi
```

The multilingual template uses exactly this for Arabic and Chinese, so it
compiles cleanly whether or not those fonts are installed.

## Serbian: one language, two scripts

Serbian is the textbook dual-script case — it is written in **both** Cyrillic
and Latin, treated as fully equal. polyglossia selects the script with the
`script` option (`variant` is something else for Serbian: it switches the
ekavian/ijekavian *dialect*). Declare the language once with a default script,
then override per block:

```latex
% Preamble: declare Serbian with a default script.
\setotherlanguage[script=cyrillic]{serbian}

% Body: pick the script per block.
\begin{serbian}[script=latin]
Đačko društvo čeka prijatan, žustar i živahan ćuk.   % Latin (latinica)
\end{serbian}

\begin{serbian}[script=cyrillic]
Ђачко друштво чека пријатан, жустар и живахан ћук.   % Cyrillic (ћирилица)
\end{serbian}
```

Because both scripts need Cyrillic **and** Latin coverage, pair this with a
main font that has both (CMU Serif or FreeSerif).

## Where to go next

- Build and read [`templates/multilingual/`](../templates/multilingual/) — it
  contains live examples of German, French, Serbian (both scripts), Russian,
  Greek, Arabic (RTL), and Chinese (CJK), with comments at each trap.
- Run the **`/i18n`** skill to add a language to your own project; per-language
  recipes live in the skill's `references/languages.md`.
- See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the project-wide i18n
  policy.
