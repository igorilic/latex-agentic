---
name: bibliography
description: Manage references with biblatex/biber. Use to add a citation from a DOI, arXiv id, or paper title; to set up bibliography wiring in a document; or to check the bibliography for duplicates, missing fields, and unused entries. Triggers on phrases like "add citation", "cite this paper", "add reference", "fix bibliography", "set up biblatex", "check my references", "find the bibtex for".
argument-hint: [add <doi|arxiv|title> | check | setup]
---

# bibliography

Manage a project's references using `biblatex` with the `biber` backend. The
subcommand is the first argument: `setup`, `add`, or `check`. If no argument is
given, infer intent from context (a DOI/arXiv id/quoted title means `add`; an
empty or unwired project means `setup`; otherwise `check`).

Always read the project contract `.latex-agentic.json` first to learn the bib
configuration:

```bash
cat .latex-agentic.json 2>/dev/null
```

The relevant block:

```json
"bib": { "backend": "biber", "files": ["refs.bib"], "style": "authoryear" }
```

Use `bib.files[0]` as the target `.bib` file (default `refs.bib`) and
`bib.style` as the biblatex style (default `authoryear`). If `.latex-agentic.json`
is absent, default to `refs.bib` / `authoryear` and note that the project is not
yet initialized.

For anything beyond a single fetch — bulk imports, deduping a messy `.bib`,
reconciling inconsistent author formatting, or judgement calls about entry
types — delegate to the **bib-curator** agent.

---

## setup

Wire biblatex into the document so `\cite` and `\printbibliography` work.

1. Identify the main file from `.latex-agentic.json` (`main`, default
   `main.tex`) and the bib file/style as above.

2. Detect legacy BibTeX usage that must be migrated:

   ```bash
   grep -nE '\\bibliographystyle|\\bibliography\{|\\begin\{thebibliography\}' "$MAIN"
   ```

   - `\bibliographystyle{...}` and `\bibliography{refs}` is the legacy
     `bibtex`/`natbib` workflow. Plan to replace it.
   - `\begin{thebibliography}...\end{thebibliography}` is a hand-written list.
     Preserve its entries by converting each `\bibitem` into a `.bib` entry
     (delegate to **bib-curator** if there are more than a handful).

3. Ensure the preamble loads biblatex with the configured backend and style.
   Insert (or update) in the preamble, after `fontspec`/`polyglossia` but before
   `hyperref`:

   ```latex
   \usepackage[backend=biber,style=authoryear,sorting=nyt]{biblatex}
   \addbibresource{refs.bib}
   ```

   Substitute the real `style` and `.bib` filename. Use one `\addbibresource`
   line per file in `bib.files`.

4. Ensure the bibliography is printed where the references should appear
   (typically just before `\end{document}`):

   ```latex
   \printbibliography
   ```

5. Migrate legacy commands:
   - Delete `\bibliographystyle{...}`.
   - Replace `\bibliography{refs}` with `\printbibliography` (the resource is
     now declared by `\addbibresource` in the preamble).
   - For a `thebibliography` environment, after moving entries into the `.bib`
     file, delete the environment and rely on `\printbibliography`.
   - If the document used `\usepackage{natbib}`, remove it; biblatex provides
     `\citet`/`\citep` equivalents via `style=authoryear` and the `\textcite`/
     `\parencite` commands.

6. Create the `.bib` file if it does not exist:

   ```bash
   test -f refs.bib || : > refs.bib
   ```

7. Update `.latex-agentic.json` so `bib.backend`, `bib.files`, and `bib.style`
   reflect what was wired (only if they were missing or wrong).

8. Verify with a compile (engine from the contract, default xelatex). biblatex
   needs a biber run between LaTeX passes; `latexmk` handles this automatically:

   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN"
   ```

---

## add `<doi | arxiv | title>`

Fetch a BibTeX entry, normalize it, and append it to the project `.bib` file.
Detect the identifier kind from the argument:

- Looks like `10.xxxx/...` (or a `doi.org` URL) → **DOI**.
- Looks like `arXiv:NNNN.NNNNN`, `NNNN.NNNNN`, or an `arxiv.org/abs/...` URL →
  **arXiv**.
- Otherwise → free-text **title** search.

### DOI

```bash
curl -sL -H "Accept: application/x-bibtex" "https://doi.org/<doi>"
```

This returns a ready BibTeX record. Proceed to **Normalize**.

### arXiv

Query the arXiv API and convert to BibTeX. The API returns Atom XML:

```bash
curl -sL "https://export.arxiv.org/api/query?id_list=<arxiv-id>"
```

Parse `<title>`, `<author><name>`, `<published>` (year), the abstract, and the
`<arxiv:doi>`/`<arxiv:journal_ref>` if present. Build an `@article` (or
`@misc` with `eprint`/`archivePrefix={arXiv}`/`primaryClass`) entry. If the
record carries a published DOI, prefer fetching via the DOI path for richer
metadata, keeping the `eprint` field. Proceed to **Normalize**.

### Title

Search Crossref and confirm with the user before committing:

```bash
curl -sL "https://api.crossref.org/works?query.bibliographic=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "<title>")&rows=3"
```

Present the top 3 candidates (title, first author, year, container, DOI) and
ask the user which one (or none). Once chosen, fetch the canonical BibTeX via
its DOI (the DOI path above). Proceed to **Normalize**.

### Normalize

1. **Citation key** → `authorYYYYkeyword`: lowercase first author's surname +
   four-digit year + a short lowercase keyword from the title's first
   significant word (skip articles/prepositions). Example:
   `vaswani2017attention`. Ensure uniqueness against existing keys; append
   `a`/`b`/`c` on collision.

2. **Brace-protect proper nouns and acronyms** in the `title` field so biblatex
   does not lowercase them under title-case styles, e.g.
   `title = {{BERT}: Pre-training of Deep {Transformers}}`. Wrap acronyms,
   names, and any all-caps tokens in braces.

3. Tidy fields: ensure `author` uses `Surname, Given and Surname, Given`
   format; keep `doi`, `url`, `year`/`date`, `journal`/`booktitle`, `volume`,
   `number`, `pages`, `publisher` when available; drop empty fields.

4. Append the entry to the configured `.bib` file (do not overwrite existing
   content):

   ```bash
   printf '\n%s\n' "$ENTRY" >> refs.bib
   ```

5. Report the new key and remind the user to `\cite{<key>}` (or `\autocite`/
   `\textcite`). Offer to insert the citation at the cursor location if a
   target is obvious.

If any fetch returns empty or an HTTP error, report it plainly and offer the
title-search fallback. Never fabricate metadata.

---

## check

Audit the bibliography for correctness. Operate over every file in `bib.files`
and the document's `\cite` usage.

1. **Duplicate keys** — same `@type{key,` defined twice:

   ```bash
   grep -hoE '^@[A-Za-z]+\{[^,]+,' refs.bib | sed -E 's/^@[A-Za-z]+\{//; s/,$//' | sort | uniq -d
   ```

   Report each duplicate; keep the most complete entry and remove the rest
   (confirm with the user before deleting).

2. **Missing required fields per entry type.** Check each entry against its
   type's required fields:
   - `@article`: `author`, `title`, `journaltitle`/`journal`, `year`/`date`.
   - `@book`: `author`/`editor`, `title`, `publisher`, `year`/`date`.
   - `@inproceedings`: `author`, `title`, `booktitle`, `year`/`date`.
   - `@incollection`: `author`, `title`, `booktitle`, `publisher`, `year`/`date`.
   - `@misc`/`@online`: `title` plus `author`/`url`/`year` as available.

   Flag entries lacking a required field.

3. **Unused entries vs `\cite` usage.** Collect cited keys from all `.tex`
   files and compare against defined keys:

   ```bash
   grep -rhoE '\\(auto|text|paren|foot|smart|super)?cite[a-z]*\*?(\[[^]]*\])*\{[^}]*\}' . --include='*.tex' \
     | grep -oE '\{[^}]*\}$' | tr -d '{}' | tr ',' '\n' | sed 's/ //g' | sort -u > /tmp/cited-keys.txt
   grep -hoE '^@[A-Za-z]+\{[^,]+,' refs.bib | sed -E 's/^@[A-Za-z]+\{//; s/,$//' | sort -u > /tmp/defined-keys.txt
   echo "== cited but undefined (errors) ==";  comm -23 /tmp/cited-keys.txt /tmp/defined-keys.txt
   echo "== defined but never cited (unused) =="; comm -13 /tmp/cited-keys.txt /tmp/defined-keys.txt
   ```

   "Cited but undefined" are hard errors. "Defined but unused" are advisory
   (with `style=authoryear` only cited entries print unless `\nocite{*}` is
   used) — list them but do not delete without confirmation.

4. **biber validation run.** Compile once so the `.bcf` exists, then run biber
   in validation mode to surge structural problems and warnings:

   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN" >/dev/null 2>&1 || true
   biber --tool --validate-datamodel refs.bib 2>&1 | tail -n 40
   ```

   Also surface biber's own messages from the main run:

   ```bash
   grep -iE 'WARN|ERROR' "${MAIN%.tex}.blg" 2>/dev/null | tail -n 30
   ```

5. Summarize findings grouped as **errors** (undefined citations, malformed
   entries) and **warnings** (missing optional fields, unused entries,
   inconsistent formatting). For non-trivial cleanup, hand the file to the
   **bib-curator** agent with the findings list.
