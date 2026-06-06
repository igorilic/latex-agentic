---
name: structure
description: Manage document structure and navigation — table of contents, lists of figures/tables, cross-references, hyperref/cleveref wiring, PDF bookmarks/metadata, appendices, sectioning depth. Use to add a TOC, fix broken \ref/\cref, set up links, audit labels, or tune numbering. Triggers on "table of contents", "cross-references", "broken references", "add hyperref", "pdf bookmarks", "cleveref".
---

# structure

Set up and audit a document's structure and navigation: table of contents,
lists, cross-references, hyperlinks, PDF metadata, appendices, and sectioning
depth. Read `.latex-agentic.json` for the main file (`main`, default
`main.tex`); operate on it and any `\input`/`\include`d files.

The single most important rule: **`hyperref` is loaded LAST in the preamble**
(it redefines many internal commands), and **`cleveref` is loaded after
`hyperref`**. Almost nothing should come after these two.

---

## 1. Table of contents and lists

1. Ensure `\tableofcontents` appears after `\begin{document}` and any title
   block (`\maketitle`), before the first section. Add it if the user wants
   navigation and it is absent.

2. Optionally add `\listoffigures` and/or `\listoftables` immediately after the
   TOC when the document contains floats:

   ```latex
   \tableofcontents
   \listoffigures   % only if figures exist
   \listoftables    % only if tables exist
   ```

3. For documents where the TOC should start on its own page, add `\clearpage`
   after it.

---

## 2. Hyperlinks, bookmarks, and PDF metadata

1. Load `hyperref` as the last package, then `cleveref`:

   ```latex
   \usepackage{hyperref}
   \usepackage{cleveref}
   ```

   If other packages currently sit after `hyperref`, move `hyperref` (and
   `cleveref` after it) to the end of the preamble. Known exceptions that may
   legitimately follow `hyperref` (e.g. `bookmark`, `glossaries` ordering)
   should be preserved in their documented order.

2. Configure bookmarks and metadata via `\hypersetup`. Pull the title and
   author from the document's `\title{...}`/`\author{...}` (grep them out); do
   not invent values:

   ```latex
   \hypersetup{
     pdftitle={<title from \title>},
     pdfauthor={<author from \author>},
     bookmarksnumbered=true,
     bookmarksopen=true,
     colorlinks=true,
     linkcolor=black,
     citecolor=black,
     urlcolor=blue,
     hidelinks=false
   }
   ```

   For print-oriented documents, prefer `hidelinks` or muted colors so links
   are not garish on paper. Confirm the user's preference if unclear.

3. To extract existing title/author:

   ```bash
   grep -nE '\\title\{|\\author\{' "$MAIN"
   ```

---

## 3. Cross-reference conventions (cleveref)

1. Use `\cref{<label>}` (lowercase, mid-sentence) and `\Cref{<label>}`
   (capitalized, sentence start) instead of manual "Figure~\ref{...}". cleveref
   inserts the type name automatically: `\cref{fig:flow}` → "figure 1".

2. Adopt a label-prefix convention and apply it consistently:
   `fig:`, `tab:`, `eq:`, `sec:`, `lst:`, `alg:`, `app:`. Labels go
   immediately after the captioned object's `\caption{...}` (for floats) or
   right after the sectioning command (for sections).

3. Optionally define ranges and conjunctions with `\crefrange`,
   `\cref{a,b,c}` (cleveref handles the list/range grammar).

---

## 4. Audit pass

Find structural defects. Run these greps over the project `.tex` files.

1. **Sections missing a nearby `\label`.** Sectioning commands that should be
   cross-referenceable but have no label within a couple of lines:

   ```bash
   grep -nE '\\(chapter|section|subsection)\*?\{' $FILES
   grep -nE '\\label\{' $FILES
   ```

   For each `\section`/`\subsection`, check whether a `\label{sec:...}` follows
   within ~3 lines; report those that do not (only relevant ones — not every
   subsection needs a label).

2. **References to nonexistent labels.** Collect all defined labels and all
   referenced labels, then diff:

   ```bash
   grep -rhoE '\\label\{[^}]*\}' $FILES | sed -E 's/.*\{([^}]*)\}/\1/' | sort -u > /tmp/labels-defined.txt
   grep -rhoE '\\(c|C)?ref\*?\{[^}]*\}' $FILES | grep -oE '\{[^}]*\}' | tr -d '{}' | tr ',' '\n' | sed 's/ //g' | sort -u > /tmp/labels-used.txt
   echo "== referenced but never defined =="; comm -23 /tmp/labels-used.txt /tmp/labels-defined.txt
   echo "== defined but never referenced =="; comm -13 /tmp/labels-used.txt /tmp/labels-defined.txt
   ```

3. **Cross-check against the compiler's view.** After a compile, the `.log`
   reports undefined references authoritatively:

   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN" >/dev/null 2>&1 || true
   grep -iE "undefined reference|Reference .* undefined|may have changed|rerun" "${MAIN%.tex}.log" | sort -u
   ```

   "Rerun to get cross-references right" just means another LaTeX pass is
   needed — `latexmk` normally resolves this on its own. Genuine "undefined
   reference" warnings are the actionable ones.

4. Report results grouped as **errors** (referenced-but-undefined labels) and
   **warnings** (sections lacking labels, defined-but-unused labels). Fix the
   errors; leave unused labels unless the user wants them pruned.

---

## 5. Appendices

When the document has appendix material, mark the transition so numbering
switches to A, B, C and section names read "Appendix A":

```latex
\appendix
\section{Supplementary derivations}\label{app:derivations}
```

If the document uses the `appendix` package features (e.g. a per-appendix TOC),
load `appendix` and use `\begin{appendices}...\end{appendices}`; otherwise the
plain `\appendix` switch is sufficient and preferred.

---

## 6. Sectioning depth tuning

1. **`secnumdepth`** controls how deep numbering goes; **`tocdepth`** controls
   how deep the TOC lists. Set them in the preamble:

   ```latex
   \setcounter{secnumdepth}{3}  % number down to \subsubsection
   \setcounter{tocdepth}{2}     % list down to \subsection in the TOC
   ```

   Choose values from the document's structure: a short article rarely needs
   `\subsubsection` numbering (use `2`); a long report may want `3`. Confirm
   with the user when changing existing values.

2. To suppress numbering for a single heading while keeping it in the TOC, use
   the starred form plus `\addcontentsline`:

   ```latex
   \section*{Acknowledgments}
   \addcontentsline{toc}{section}{Acknowledgments}
   ```

Finish by recompiling and re-running the audit greps to confirm the TOC,
bookmarks, and cross-references resolve cleanly.
