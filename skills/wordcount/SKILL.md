---
name: wordcount
description: Count words in the LaTeX project using texcount — total across all included files plus a per-section breakdown — reading the main file from .latex-agentic.json. Falls back to a conservative detex-style pipeline when texcount is unavailable, and explains what is and isn't counted. Use when the user says "word count", "how many words", "wordcount", "count words", "how long is this".
---

# wordcount

Report the word count of the document, following `\input`/`\include` files, and
break it down by section.

## Procedure

1. **Read the project contract** for the main file. From `.latex-agentic.json`,
   read `main` (fall back to `main.tex`):
   ```bash
   MAIN=$(jq -r '.main // "main.tex"' .latex-agentic.json 2>/dev/null || echo main.tex)
   ```

2. **Total count (preferred — texcount).** `-inc` follows included files,
   `-total` prints just the grand total, `-brief` keeps output tidy:
   ```bash
   texcount -inc -total -brief "$MAIN"
   ```
   Report the total word count. texcount separates text words from
   header/caption words and counts of math — surface the headline "words in
   text" number plus, when useful, words in headers and captions.

3. **Per-section table.** Re-run texcount split by section to show where the
   words are:
   ```bash
   texcount -inc -sub=section "$MAIN"
   ```
   Summarize as a small table: section title → words in text (and
   headers/captions/math if the user wants detail). This makes it obvious which
   section is over- or under-weight.

4. **Fallback when texcount is missing.** If `command -v texcount` fails, use a
   conservative strip-and-count pipeline. Strip comments, drop the preamble,
   remove commands and math, then count words:
   ```bash
   # Concatenate main + any \input/\include is best-effort here; run per file.
   sed -e 's/\([^\\]\)%.*/\1/' -e 's/^%.*//' "$MAIN" \
     | awk '/\\begin\{document\}/{p=1;next} /\\end\{document\}/{p=0} p' \
     | sed -e 's/\$[^$]*\$//g' \
           -e 's/\\[a-zA-Z@]*\*\?//g' \
           -e 's/[{}\[\]]//g' \
     | tr -s ' \t' '\n' \
     | grep -E '[[:alpha:]]' \
     | wc -w
   ```
   This is an approximation: it removes inline math and command tokens but
   cannot follow `\input` automatically, so run it per source file and sum, and
   clearly label the result as approximate. Prefer installing texcount
   (`tlmgr install texcount`) for an accurate figure.

5. **Explain what counts.** Always tell the user what the number includes so
   they can interpret it:
   - Body text words are the headline figure.
   - **Headers** (section/chapter titles), **captions**, and the **abstract**
     are counted by texcount but reported in separate buckets — they can be
     toggled. Note that journal/word limits usually mean *body text only*.
   - **Math** is reported as inline/displayed counts, not words.
   - Footnotes are included in the text count; the bibliography is not counted.
   - The fallback pipeline is a rougher estimate and excludes included files
     unless run on each.
