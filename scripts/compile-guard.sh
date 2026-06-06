#!/usr/bin/env bash
# compile-guard.sh — PreToolUse hook (matcher Bash).
#
# If a Bash command is about to invoke pdflatex, and the project's *.tex files
# use XeLaTeX-only packages (fontspec / polyglossia / xeCJK), emit an advisory
# nudging toward `latexmk -xelatex`. ADVISORY ONLY: never emits a
# permissionDecision; never blocks the command.
#
# Always exits 0; diagnostics to stderr.

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib.sh" 2>/dev/null || exit 0

RAW="$(read_stdin)"
[ -n "$RAW" ] || exit 0

command_str="$(json_field "$RAW" '.tool_input.command')"
[ -n "$command_str" ] || exit 0

# Match a real pdflatex invocation: start of string or after a shell separator
# (; & | space), then the word pdflatex at a word boundary. Guards against
# false positives like "xpdflatex" or paths containing the substring.
if ! printf '%s' "$command_str" | grep -Eq '(^|[;&|[:space:]])pdflatex\b'; then
  exit 0
fi

# Scan *.tex in cwd (non-recursive) for XeLaTeX-only packages. Stop at the
# first matching file to keep this cheap.
offending_file=""
shopt -s nullglob 2>/dev/null
for f in ./*.tex; do
  if grep -lEm1 'fontspec|polyglossia|xeCJK' "$f" >/dev/null 2>&1; then
    offending_file="$(basename "$f")"
    break
  fi
done
shopt -u nullglob 2>/dev/null

[ -n "$offending_file" ] || exit 0

advisory="Advisory: this command runs pdflatex, but ${offending_file} loads XeLaTeX-only packages (fontspec / polyglossia / xeCJK). pdflatex will likely fail. Recommended: latexmk -xelatex -interaction=nonstopmode -file-line-error -halt-on-error <main>. (Advisory only; the command is not blocked.)"

emit_context "PreToolUse" "$advisory"
exit 0
