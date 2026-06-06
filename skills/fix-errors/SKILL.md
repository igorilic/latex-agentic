---
name: fix-errors
description: Diagnose and repair LaTeX compilation failures in a bounded loop — compile capturing the log, isolate the FIRST error, look it up in the error playbook, apply the minimal fix, recompile, repeat (max 5 iterations). Use when a build fails, the user says "fix errors", "fix the compile", "it won't compile", "debug the LaTeX", or when the /compile skill hands off a failure.
---

# fix-errors

The repair loop. LaTeX errors cascade: the first reported error is usually the
real cause and the rest are noise, so fix exactly one error per pass and
recompile. Bounded to 5 iterations to avoid thrashing.

## Procedure

1. **Read the project contract.** From `.latex-agentic.json`, read `main` and
   `engine` (fall back to `main.tex` / `xelatex`):
   ```bash
   MAIN=$(jq -r '.main // "main.tex"' .latex-agentic.json 2>/dev/null || echo main.tex)
   ```

2. **Compile, capturing the log:**
   ```bash
   latexmk -xelatex -interaction=nonstopmode -file-line-error "$MAIN" 2>&1 | tee /tmp/latex-agentic-fix.log
   ```
   (Use the engine flag from the contract if not xelatex.) If it succeeds, stop
   and report success.

3. **Isolate the FIRST error.** LaTeX TeX errors start with `!`; file-line-error
   mode prefixes location as `file:line:`:
   ```bash
   grep -n -m1 '^!' "${MAIN%.tex}.log"
   grep -n -m1 -E '^[^:]+:[0-9]+:' "${MAIN%.tex}.log"
   ```
   Take the earliest of these and read a few lines around it for context
   (the offending line, the `l.NNN` echo, and the error message). Ignore all
   later errors this pass.

4. **Look it up in the playbook.** Match the error against the symptom patterns
   in `${CLAUDE_PLUGIN_ROOT}/skills/fix-errors/references/error-playbook.md`
   (also readable at `references/error-playbook.md` within this skill). Each
   entry gives the cause and the minimal fix.

5. **Apply the minimal fix.** Change the smallest thing that resolves the
   error — escape a character, balance a brace, add a missing package, switch
   engine, insert `\addbibresource`, etc. Prefer the Edit tool for precise,
   reviewable edits. Do not refactor unrelated content. For missing-package
   errors, suggest the exact `tlmgr install <pkg>` command rather than guessing
   alternative packages. When the fix is genuinely non-obvious, delegate to the
   **error-doctor** agent with the first-error block and let it propose the fix.

6. **Recompile** (repeat step 2). If clean, go to step 8.

7. **Loop, max 5 iterations.** Track an attempt counter. If the same error
   persists across two passes, or you hit 5 iterations without a clean build,
   stop and escalate: report the remaining first error, what you tried, and the
   relevant playbook entry, and ask the user how to proceed. Never loop
   silently forever.

8. **Summarize.** Report each change made (file, line, before → after), the
   playbook entry that matched, the number of iterations used, and the final
   compile status (pages on success).

## Reference

The error catalogue lives in
[`references/error-playbook.md`](references/error-playbook.md) — symptom (exact
log pattern), cause, and fix for ~30 common LaTeX/XeLaTeX failures.
