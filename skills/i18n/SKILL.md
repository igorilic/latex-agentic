---
name: i18n
description: Set up multilingual, multi-script typesetting with polyglossia and fontspec under XeLaTeX. Use to add a language, configure fonts per script (Latin, Cyrillic, Greek, Arabic, Hebrew, CJK, Devanagari), handle RTL or CJK text, or fix font fallback. Triggers on "add a language", "write in Russian/Arabic/Chinese", "set up polyglossia", "right to left text", "i18n", "Serbian Cyrillic".
argument-hint: [language ...]
---

# i18n

Configure a document for one or more languages and scripts using `polyglossia`
+ `fontspec` under XeLaTeX. The arguments are the target languages (e.g.
`i18n russian arabic` or `i18n serbian-cyrillic`). If none are given, read the
`languages` array from `.latex-agentic.json`, and ask the user which languages
to add if it is empty.

The per-language recipes — preamble snippets, font candidate chains, sample
sentences, and gotchas — live in
`${CLAUDE_PLUGIN_ROOT}/skills/i18n/references/languages.md`. Read that file and
copy the relevant recipe for each requested language rather than improvising.

For involved multilingual layout work (mixed RTL/LTR runs, CJK line-breaking,
font shaping problems), delegate to the **i18n-typesetter** agent.

---

## Procedure

1. **Resolve the language list.** Combine the arguments with the existing
   `languages` array from the contract:

   ```bash
   cat .latex-agentic.json 2>/dev/null
   ```

   Identify the primary (default) language and any secondary languages. For
   Serbian, clarify which script(s): `serbian-cyrillic`, `serbian-latin`, or
   both — they need different `polyglossia` variants and may use different
   fonts.

2. **Confirm XeLaTeX.** This workflow requires the `xelatex` engine
   (`fontspec`/`polyglossia` do not work under pdflatex). If
   `.latex-agentic.json` has `"engine": "pdflatex"`, advise switching to
   `xelatex` and update it (with the user's agreement).

3. **Load polyglossia and set languages.** In the preamble, after `fontspec`:

   ```latex
   \usepackage{fontspec}
   \usepackage{polyglossia}
   \setdefaultlanguage{<primary>}
   \setotherlanguage{<secondary-1>}
   \setotherlanguage{<secondary-2>}
   ```

   Use the polyglossia language names and options from the recipe — e.g.
   `[variant=...]` for dialects (`[variant=british]{english}`,
   `[variant=monotonic]{greek}`) and `[script=...]` where a language has
   multiple scripts (`\setotherlanguage[script=cyrillic]{serbian}`), or plain
   `\setotherlanguage{arabic}`.

4. **Configure fonts per script with explicit fallback chains.** For each
   script in play, define a font family guarded by `\IfFontExistsTF` so the
   document still compiles when the preferred font is absent. Prefer
   TeX Live-shipped fonts first, then Noto, then common OS fonts:
   - Latin / Cyrillic / Greek: **CMU Serif** → Noto Serif → DejaVu Serif.
   - Arabic (and Persian/Urdu): **Amiri** → Noto Naskh Arabic → Scheherazade.
   - Chinese (simplified): **FandolSong** → Noto Serif CJK SC → Source Han Serif.
   - Japanese: **HaranoAjiMincho** → Noto Serif CJK JP.
   - Korean: **NanumMyeongjo** → Noto Serif CJK KR.
   - Hebrew: **Noto Serif Hebrew** → David CLM → Frank Ruehl CLM.
   - Devanagari (Hindi): **Noto Serif Devanagari** → Shobhika → Lohit Devanagari.

   The fallback pattern (one family per non-default script, paired to its
   polyglossia language via `\newfontfamily\<lang>font`):

   ```latex
   \newfontfamily\arabicfont[Script=Arabic]{Amiri}
   % guarded variant:
   \IfFontExistsTF{Amiri}
     {\newfontfamily\arabicfont[Script=Arabic]{Amiri}}
     {\IfFontExistsTF{Noto Naskh Arabic}
        {\newfontfamily\arabicfont[Script=Arabic]{Noto Naskh Arabic}}
        {\newfontfamily\arabicfont[Script=Arabic]{Scheherazade New}}}
   ```

   Set the main document font from the primary language's recipe with
   `\setmainfont`. Copy the exact `\newfontfamily` lines (including
   `Script=`/`Language=` options) from `references/languages.md`.

5. **Enable xeCJK when any CJK language is present.** Load it (after fontspec,
   before polyglossia's CJK font setup) and set the CJK main font:

   ```latex
   \usepackage{xeCJK}
   \setCJKmainfont{FandolSong}   % or Noto Serif CJK SC, per recipe
   ```

6. **RTL load-order trap.** For Arabic/Hebrew/Persian, **do not** load `bidi`
   manually — `polyglossia` loads it last, in the correct position, on its own.
   Loading `bidi` (or `hyperref` after `bidi` incorrectly) by hand causes the
   classic "bidi must be loaded last" / reversed-output errors. Just declare
   the RTL language with `\setotherlanguage` and switch with
   `\begin{<lang>}...\end{<lang>}` or `\text<lang>{...}`. If `hyperref` is in
   the document, it still loads near the end but polyglossia's bidi
   coordination takes precedence — let polyglossia manage it.

7. **Switch languages in the body.** Use environments for blocks and inline
   commands for short runs:

   ```latex
   \begin{arabic}…\end{arabic}        % block
   \textrussian{…}                    % inline
   ```

8. **Update the contract.** Write the final language set back into
   `.latex-agentic.json`'s `languages` array (primary first), and ensure
   `"engine": "xelatex"`.

9. **Test compile with a sample sentence per language.** Insert each language's
   real sample sentence (from the recipe) into the body, then compile with the
   canonical command and confirm the script renders (no tofu boxes, correct
   direction):

   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN"
   ```

   Inspect the resulting PDF (or the `.log` for missing-font / missing-glyph
   warnings). Remove the sample sentences afterward unless the user wants them
   kept. If a preferred font was unavailable, report which fallback was used
   and how to install the preferred one.
