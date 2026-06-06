# LaTeX / XeLaTeX Error Playbook

A lookup table for the `fix-errors` repair loop. Each entry is **symptom**
(the exact pattern you will see in the `.log`), **cause**, and **fix**
(the minimal change). Always fix the FIRST error and recompile — later errors
usually cascade from it.

This harness is XeLaTeX-first (`latexmk -xelatex`, UTF-8, `fontspec` +
`polyglossia`). Several entries below exist specifically to migrate
pdfLaTeX-era habits to XeLaTeX.

---

## 1. Undefined control sequence

- **Symptom:** `! Undefined control sequence.` followed by `l.NNN \somecommand`.
- **Cause:** A command that LaTeX does not know — a typo, or a macro from a
  package that was never loaded.
- **Fix:** Correct the spelling, or load the providing package in the preamble
  (e.g. `\usepackage{amsmath}` for `\text`, `\usepackage{xcolor}` for
  `\textcolor`, `\usepackage{graphicx}` for `\includegraphics`). Verify the
  package exists with `kpsewhich <pkg>.sty` before adding it.

## 2. Missing $ inserted

- **Symptom:** `! Missing $ inserted.`
- **Cause:** A math-only character (`_`, `^`, `\alpha`, `\sum`, etc.) used in
  text mode, or unbalanced `$`.
- **Fix:** Wrap the math in `$ ... $` (or `\( ... \)`), or escape a literal
  underscore as `\_`. Check for a missing closing `$` earlier on the line.

## 3. File `X.sty` not found

- **Symptom:** `! LaTeX Error: File \`X.sty' not found.` or
  `kpathsea: ... X.sty`.
- **Cause:** The package is not installed in the TeX distribution.
- **Fix:** Install it. Find the package name and run:
  `tlmgr install X` (use `sudo` if the tree is system-owned; on a user tree,
  `tlmgr install --usermode X`). Confirm with `kpsewhich X.sty`. Do not
  substitute a different package name on a guess.

## 4. Undefined citation / reference (rerun + biber)

- **Symptom:** `LaTeX Warning: Citation 'key' on page N undefined` /
  `Reference \`label' on page N undefined` / `Empty bibliography`.
- **Cause:** The aux/bbl data is stale — biber/bibtex has not run yet, or one
  more LaTeX pass is needed to resolve labels.
- **Fix:** Run the full pipeline. `latexmk` normally does this automatically;
  if invoking by hand: `xelatex main` → `biber main` → `xelatex main` →
  `xelatex main`. Ensure the `.bcf` file is fresh (delete stale `.bbl`/`.bcf`
  if the backend changed).

## 5. Misplaced alignment tab character &

- **Symptom:** `! Misplaced alignment tab character &.`
- **Cause:** A literal `&` outside a tabular/align environment, or one too many
  `&` columns in a row.
- **Fix:** Escape a literal ampersand as `\&`. Inside a table, count the
  columns in the `\begin{tabular}{...}` preamble and remove the extra `&`.

## 6. Extra }, or forgotten \endgroup

- **Symptom:** `! Too many }'s.` or `! Extra }, or forgotten \endgroup.`
- **Cause:** An unbalanced closing brace, or a group/environment opened with
  `\begingroup`/`{` and never properly closed before another close.
- **Fix:** Balance the braces on the offending line; add the missing
  `\endgroup` or `{`. A brace counter over the file pinpoints the imbalance.

## 7. Runaway argument

- **Symptom:** `Runaway argument?` followed by echoed text and
  `! Paragraph ended before \command was complete.` or `! File ended ...`.
- **Cause:** A missing closing brace `}` for a command argument, or a blank
  line inside an argument that does not accept paragraph breaks.
- **Fix:** Add the missing `}`; remove the stray blank line inside the
  argument. The echoed runaway text shows where the argument started.

## 8. Paragraph ended before \command was complete

- **Symptom:** `! Paragraph ended before \command was complete.`
- **Cause:** A blank line (= `\par`) appeared inside the argument of a command
  that is not `\long`, e.g. `\section{...}`, `\textbf{...}`, `\footnote{...}`.
- **Fix:** Remove the blank line inside the braces, or close the argument with
  `}` where it was meant to end.

## 9. fontspec: font not found

- **Symptom:** `! fontspec error: "font-not-found"` /
  `The font "X" cannot be found.` /
  `Package fontspec Info: ... cannot be found`.
- **Cause:** `\setmainfont{X}` / `\newfontfamily` names a font not installed on
  the system (XeLaTeX resolves fonts by system name, not via TeX).
- **Fix:** Install the font (e.g. the Noto families) or pick an installed one.
  List candidates with `fc-list | grep -i noto`. Default fallbacks for this
  harness: `Noto Serif`, `Noto Sans`, `Noto Sans Arabic`, `Noto Serif CJK`.

## 10. Unicode character not set up for use with LaTeX (use XeLaTeX)

- **Symptom:** `! Package inputenc Error: Unicode character X (U+NNNN) not set
  up for use with LaTeX.` or `! LaTeX Error: Unicode character not set up...`.
- **Cause:** A non-ASCII character compiled under **pdfLaTeX** without proper
  encoding support.
- **Fix:** Compile with **XeLaTeX** instead (`latexmk -xelatex`). Ensure
  `.latex-agentic.json` has `"engine": "xelatex"`, and remove `inputenc`
  (see entry 11). XeLaTeX reads UTF-8 natively.

## 11. inputenc / fontenc clash under XeLaTeX

- **Symptom:** `Package inputenc Warning/Error` or odd glyphs while running
  XeLaTeX; `\usepackage[utf8]{inputenc}` / `\usepackage[T1]{fontenc}` present.
- **Cause:** `inputenc` and the T1-via-`fontenc` route are pdfLaTeX legacy and
  conflict with XeLaTeX's native Unicode + `fontspec`.
- **Fix:** Remove `\usepackage[utf8]{inputenc}` and `\usepackage[T1]{fontenc}`.
  Use `\usepackage{fontspec}` instead; XeLaTeX is UTF-8 by default.

## 12. polyglossia + bidi ordering

- **Symptom:** RTL text mis-shaped/mis-ordered, or
  `Package bidi Error: ... must be loaded as the last package`.
- **Cause:** Load-order trap — `bidi` (pulled in by `polyglossia` for RTL) must
  be the **last** package loaded; another package loaded after it breaks bidi.
- **Fix:** Move `\usepackage{polyglossia}` (and any explicit `bidi`) so it is
  loaded **last** in the preamble, after hyperref and everything else. Set
  languages with `\setmainlanguage` / `\setotherlanguage`.

## 13. biber / bibtex backend mismatch (.bcf errors)

- **Symptom:** `Biber ... .bcf` / `You must run biber ... not bibtex` /
  `Found biblatex control file version X, expected version Y` /
  `I found no \citation commands`.
- **Cause:** The biblatex `backend=` option does not match the program run, or
  a stale `.bcf`/`.bbl` from a previous backend.
- **Fix:** Make them agree. For `backend=biber` run **biber** (the default and
  the harness default); for `backend=bibtex` run **bibtex**. Delete stale
  `.bcf`/`.bbl`/`.aux` and recompile so latexmk regenerates them.

## 14. Empty bibliography (no \addbibresource / no biber run)

- **Symptom:** Bibliography section is empty; log shows
  `Empty bibliography` or `Please (re)run Biber` and no `.bbl` is produced.
- **Cause:** With biblatex, the `.bib` was never registered, or biber never
  ran.
- **Fix:** Add `\addbibresource{refs.bib}` in the preamble (biblatex uses this,
  **not** `\bibliography{}`), ensure `\printbibliography` is in the body, then
  run the biber pass. `latexmk -xelatex` triggers biber automatically.

## 15. Overfull \hbox

- **Symptom:** `Overfull \hbox (X.Ypt too wide) in paragraph at lines N--M`.
- **Cause:** A line of text/an object is wider than the text block — often a
  long unbreakable word, URL, or wide table.
- **Fix:** Usually cosmetic (warning, not error). Reduce with `\usepackage{microtype}`,
  allow hyphenation (`\hyphenation{...}`), wrap URLs with `\usepackage{url}` /
  `\url{}`, or resize the offending box. For tables use `tabularx`/`p{}` columns.

## 16. Float(s) lost

- **Symptom:** `LaTeX Warning: Float(s) lost.` / `! LaTeX Error: Too many
  unprocessed floats.`
- **Cause:** A figure/table float was placed somewhere illegal (e.g. inside a
  non-float environment) or too many floats queued without a flush.
- **Fix:** Move the `figure`/`table` to a valid context; add `\clearpage` or
  `\FloatBarrier` (from `placeins`) to flush the queue; relax placement with
  `[htbp]` or `[H]` (`float` package).

## 17. Not in outer par mode

- **Symptom:** `! LaTeX Error: Not in outer par mode.`
- **Cause:** A float (`\begin{figure}`/`\begin{table}`) or `\marginpar` was
  started inside another box, e.g. inside a `\mbox`, a tabular cell, or another
  float.
- **Fix:** Move the float out to the main vertical list. For an image inside a
  table cell, drop the surrounding `figure` and use a bare `\includegraphics`.

## 18. \verb used inside an argument

- **Symptom:** `! LaTeX Error: \verb illegal in command argument.` or a
  runaway after `\verb`.
- **Cause:** `\verb`/`verbatim` cannot appear inside the argument of another
  command (e.g. `\footnote{\verb|x|}`, `\section{\verb|x|}`).
- **Fix:** Take the verbatim text out of the argument, or use a robust
  alternative such as `\texttt{...}` with manually escaped characters, or the
  `\cprotect` macro from the `cprotect` package.

## 19. Missing \begin{document}

- **Symptom:** `! LaTeX Error: Missing \begin{document}.`
- **Cause:** Printable text or a stray non-preamble token appears before
  `\begin{document}` — often a typo or an encoding BOM/character in the
  preamble.
- **Fix:** Ensure all content sits **after** `\begin{document}`; move stray
  text down. Check for accidental characters or a leftover `}` in the preamble.

## 20. Environment X undefined

- **Symptom:** `! LaTeX Error: Environment X undefined.`
- **Cause:** `\begin{X}` for an environment whose providing package is not
  loaded, or a typo in the environment name.
- **Fix:** Load the package that defines it (e.g. `algorithm` →
  `\usepackage{algorithm}`, `tikzpicture` → `\usepackage{tikz}`) or fix the
  name. Verify with `kpsewhich`.

## 21. Option clash for package

- **Symptom:** `! LaTeX Error: Option clash for package X.`
- **Cause:** The package was loaded twice with different options (often once
  implicitly by another package, once explicitly).
- **Fix:** Load the package only once, early, with the union of options; remove
  the duplicate `\usepackage`. Use `\PassOptionsToPackage{opt}{X}` before the
  package that pulls X in if you cannot reorder.

## 22. Command already defined

- **Symptom:** `! LaTeX Error: Command \X already defined.` /
  `Or name \end... illegal, see p.192 of the manual.`
- **Cause:** `\newcommand{\X}` for a macro that already exists (from a package
  or an earlier definition).
- **Fix:** Rename your macro, or use `\renewcommand{\X}` if you intend to
  override, or `\providecommand` to define only if absent.

## 23. Dimension too large

- **Symptom:** `! Dimension too large.`
- **Cause:** A length exceeded TeX's max (~16384 pt / 575 cm) — e.g. a huge
  `\hspace`, an oversized rule, or a runaway table width computation.
- **Fix:** Reduce the offending dimension; cap widths with `\linewidth`/
  `\textwidth` fractions; for very wide content use `adjustbox`/`tabularx` or
  scale with `\resizebox{\linewidth}{!}{...}`.

## 24. Double subscript / double superscript

- **Symptom:** `! Double subscript.` or `! Double superscript.`
- **Cause:** Two `_` or two `^` apply to the same atom, e.g. `x_i_j` or
  `x^2^3`.
- **Fix:** Group with braces: `x_{i_j}` or `x_{ij}`, `x^{2^3}` or `{x^2}^3`.
  For a literal underscore in math, use `\_` or `\mathrm`.

## 25. expl3 / LaTeX3 deprecation notes

- **Symptom:** `Package expl3 Warning: deprecated ...` /
  `... has been deprecated and will be removed`.
- **Cause:** A package (or your code) uses an expl3 function/format that newer
  `expl3` flags as deprecated. These are warnings, not fatal.
- **Fix:** Update the offending package (`tlmgr update --self --all`) so it uses
  the current API. If it is your own expl3 code, switch to the replacement
  function the note names. The build still produces a PDF meanwhile.

## 26. hyperref token issues in section titles (\texorpdfstring)

- **Symptom:** `Package hyperref Warning: Token not allowed in a PDF string` /
  `Token not allowed in a PDFDocEncoded string`.
- **Cause:** Math or formatting commands (e.g. `$...$`, `\textbf`) appear in a
  sectioning command and hyperref cannot encode them into a PDF bookmark.
- **Fix:** Wrap the problematic part with
  `\texorpdfstring{<typeset version>}{<plain text for bookmark>}`, e.g.
  `\section{\texorpdfstring{$E=mc^2$}{E=mc^2}}`.

## 27. Babel / polyglossia conflict

- **Symptom:** `Package babel Error` together with polyglossia loaded, or
  `Command \X already defined` where X is a language command.
- **Cause:** `babel` and `polyglossia` both loaded — they manage languages
  incompatibly. This harness standardizes on **polyglossia** for XeLaTeX.
- **Fix:** Remove `\usepackage[...]{babel}`; use polyglossia only
  (`\setmainlanguage{...}`, `\setotherlanguage{...}`). Drop babel-specific
  language packages too.

## 28. Missing font shape warnings

- **Symptom:** `LaTeX Font Warning: Font shape \`...' undefined` /
  `Some font shapes were not available, defaults substituted`.
- **Cause:** A requested series/shape (bold, italic, small caps) is missing for
  the chosen font; LaTeX substitutes a default.
- **Fix:** Usually a benign warning. To silence it, choose a font family that
  provides the shape, or define it via `fontspec`
  (`\setmainfont{X}[BoldFont=..., ItalicFont=...]`). Avoid faux shapes unless
  acceptable.

## 29. Rerun to get cross-references right

- **Symptom:** `LaTeX Warning: Label(s) may have changed. Rerun to get
  cross-references right.`
- **Cause:** Page/label references shifted on this pass; the `.aux` is now
  consistent but the typeset references are one pass behind.
- **Fix:** Run LaTeX once more. `latexmk` does this automatically — if you see
  this persisting under latexmk, the document has an oscillating reference
  (rare); break it by stabilizing the affected labels/floats.

## 30. Missing number, treated as zero / Illegal unit of measure

- **Symptom:** `! Missing number, treated as zero.` or
  `! Illegal unit of measure (pt inserted).`
- **Cause:** A length/count command received no number or a number without a
  valid unit (e.g. `\hspace{}`, `\setlength{\parindent}{0}` without `pt`).
- **Fix:** Supply a number with a unit: `\hspace{1cm}`,
  `\setlength{\parindent}{0pt}`. Check for a missing value or a stray command
  expanding to nothing where a length was expected.

## 31. Underfull \hbox / \vbox (badness)

- **Symptom:** `Underfull \hbox (badness N) in paragraph at lines ...` /
  `Underfull \vbox (badness N) ...`.
- **Cause:** A line/page was stretched to fill space, leaving loose
  inter-word/inter-line gaps — often forced line breaks `\\` or a near-empty
  page.
- **Fix:** Cosmetic warning. Avoid unnecessary `\\`; let LaTeX break
  paragraphs; for vertical underfull, allow `\raggedbottom` or add content.
  `microtype` helps horizontal cases.

## 32. \end{...} occurred when \begin{...} on input line N was active

- **Symptom:** `! LaTeX Error: \end{A} occurred when \begin{B} was active.`
- **Cause:** Mismatched or crossed environment nesting — environments closed in
  the wrong order.
- **Fix:** Match each `\begin{X}` with the corresponding `\end{X}` and nest
  them strictly (last opened, first closed). Fix the name on the mismatched
  `\end`.
