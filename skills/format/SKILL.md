---
name: format
description: Auto-format LaTeX source with latexindent and normalize typography. Use to reindent .tex files, fix inconsistent indentation, tidy whitespace, or convert straight quotes to proper LaTeX quotes. Triggers on phrases like "format my latex", "reindent", "run latexindent", "clean up the formatting", "fix the indentation", "tidy this tex file", "normalize quotes".
---

# format

Reformat the project's tracked `.tex` source with `latexindent`, normalize
straight quotes to `\enquote`, and report a diff summary. This skill handles
mechanical source formatting; for visual polish (column spacing, float
placement, table balancing, microtype), delegate to the **typesetter** agent.

Read `.latex-agentic.json` for the main file, then determine the set of `.tex`
files to format.

1. **Verify the tool is available.**

   ```bash
   command -v latexindent || { echo "latexindent not found (install via TeX Live)"; exit 0; }
   ```

   If it is missing, report that and stop — do not attempt a manual reformat.

2. **Establish the formatting profile.** If the project has no
   `.latexindent.yaml`, write a sensible one at the project root before
   running. Defaults: two-space indentation, line-break modification disabled
   (so prose lines are never rewrapped), backups handled by the `-w`/`-b`
   flags. Create the file only if it does not already exist:

   ```bash
   test -f .latexindent.yaml || cat > .latexindent.yaml <<'YAML'
   # latex-agentic default latexindent profile
   defaultIndent: "  "        # two spaces per indent level
   modifyLineBreaks: 0        # never rewrap or move line breaks by default
   removeTrailingWhitespace: 1
   indentPreamble: 0
   YAML
   ```

   If a `.latexindent.yaml` already exists, respect it and do not overwrite.

3. **Select tracked `.tex` files.** Prefer git-tracked files; fall back to all
   `.tex` files under the project, excluding build artefacts:

   ```bash
   if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
     FILES=$(git ls-files '*.tex')
   else
     FILES=$(find . -name '*.tex' -not -path './*build*/*' -not -path './.git/*')
   fi
   echo "$FILES"
   ```

   (Listing files is read-only; running git here is for discovery, not commits.)

4. **Run latexindent in place with backups, silently.** The `-w` flag writes
   changes in place and creates a backup; `-s` silences the log chatter; `-l`
   picks up the local `.latexindent.yaml`; `-g /tmp/...` keeps the indent log
   out of the project. Process each file:

   ```bash
   for f in $FILES; do
     latexindent -w -s -l -g /tmp/latexindent.log "$f"
   done
   ```

   The `*.bak0` backups latexindent leaves behind let the user revert; mention
   them in the summary and offer to remove them once the result is approved.

5. **Normalize straight quotes to `\enquote`** where it is unambiguously safe.
   Replace paired ASCII double quotes `"..."` in prose with `\enquote{...}` and
   ensure `csquotes` is loaded. Only transform clearly textual quotes — never
   touch quotes inside verbatim, listings, code, URLs, `tikz`, or math, and
   skip any line where a quote is part of a key=value option. When in doubt,
   leave it and list it as a manual candidate. Ensure the preamble has:

   ```latex
   \usepackage{csquotes}
   ```

   Use `\enquote{...}` (which adapts to the active polyglossia language) rather
   than hard-coding `` ``...'' ``. For nested quotes, `\enquote{outer
   \enquote{inner}}` produces correct primary/secondary marks automatically.

6. **Report a diff summary.** Show what changed per file without dumping full
   files:

   ```bash
   for f in $FILES; do
     if [ -f "$f.bak0" ]; then
       echo "== $f =="
       diff -u "$f.bak0" "$f" | sed -n '1,40p'
       echo "  $(diff "$f.bak0" "$f" | grep -c '^>') lines changed"
     fi
   done
   ```

   Summarize: files touched, indentation fixes, quote conversions, and any
   manual-review candidates that were intentionally skipped.

7. **Verify formatting did not break the build.** Compile with the project
   engine (default xelatex):

   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN"
   ```

   If the compile fails, the formatting itself is rarely the cause, but restore
   from the `*.bak0` backup of the offending file and report before proceeding.

8. **Hand off visual polish.** Mechanical formatting is now done. If the user
   asked for spacing, float/figure placement, table alignment, or microtype
   tuning, delegate that to the **typesetter** agent rather than attempting it
   with latexindent.
