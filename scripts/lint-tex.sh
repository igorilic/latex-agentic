#!/usr/bin/env bash
# lint-tex.sh — PostToolUse hook (matcher Write|Edit).
#
# When Claude writes/edits a *.tex file, run a quick chktex pass (noisy rules
# suppressed) plus a cheap structural check for unbalanced \begin{X}/\end{X}.
# Findings are surfaced as additionalContext; if there's nothing useful to say,
# nothing is printed.
#
# Acts only on *.tex paths that exist. Always exits 0; diagnostics to stderr.

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib.sh" 2>/dev/null || exit 0

RAW="$(read_stdin)"
[ -n "$RAW" ] || exit 0

file_path="$(json_field "$RAW" '.tool_input.file_path')"
[ -n "$file_path" ] || exit 0

# Only LaTeX source files that actually exist on disk.
case "$file_path" in
  *.tex) : ;;
  *) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

base="$(basename "$file_path")"
findings=""

# --- chktex pass (suppress the noisiest / least actionable warnings) -------
# -n1  : "Command terminated with space."
# -n8  : "Wrong length of dash may have been used."
# -n36 : "You should put a space in front of parenthesis."
if have_cmd chktex; then
  chktex_out="$(chktex -q -n1 -n8 -n36 "$file_path" 2>/dev/null | head -12)"
  if [ -n "$chktex_out" ]; then
    findings="chktex on ${base}:
${chktex_out}"
  fi
fi

# --- Structural check: unbalanced \begin{X} vs \end{X} ---------------------
# Cheap, chktex-independent. Count per-environment opens vs closes and report
# only environments where the counts differ.
struct_out=""
if [ -r "$file_path" ]; then
  # Extract environment names from \begin{...} and \end{...}, tally, diff.
  struct_out="$(
    awk '
      {
        line = $0
        # Find all \begin{NAME}
        while (match(line, /\\begin\{[^}]+\}/)) {
          tok = substr(line, RSTART, RLENGTH)
          name = tok
          sub(/^\\begin\{/, "", name); sub(/\}$/, "", name)
          begin_count[name]++
          line = substr(line, RSTART + RLENGTH)
        }
      }
      { line2 = $0
        while (match(line2, /\\end\{[^}]+\}/)) {
          tok = substr(line2, RSTART, RLENGTH)
          name = tok
          sub(/^\\end\{/, "", name); sub(/\}$/, "", name)
          end_count[name]++
          line2 = substr(line2, RSTART + RLENGTH)
        }
      }
      END {
        for (n in begin_count) seen[n] = 1
        for (n in end_count) seen[n] = 1
        for (n in seen) {
          b = begin_count[n] + 0
          e = end_count[n] + 0
          if (b != e) {
            printf "  env \"%s\": %d \\begin vs %d \\end\n", n, b, e
          }
        }
      }
    ' "$file_path" 2>/dev/null
  )"
fi
if [ -n "$struct_out" ]; then
  if [ -n "$findings" ]; then
    findings="${findings}

Unbalanced environments in ${base}:
${struct_out}"
  else
    findings="Unbalanced environments in ${base}:
${struct_out}"
  fi
fi

# --- Emit (no-op when nothing found) ---------------------------------------
emit_context "PostToolUse" "$findings"
exit 0
