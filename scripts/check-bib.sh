#!/usr/bin/env bash
# check-bib.sh — PostToolUse hook (matcher Write|Edit).
#
# When Claude writes/edits a *.bib file, run cheap sanity checks:
#   - duplicate citation keys (@type{key, ...})
#   - per-entry brace balance ({ vs })
# Findings surface as additionalContext; silent when clean. Trailing-comma
# heuristics are intentionally skipped (too noisy / false-positive prone).
#
# Acts only on *.bib paths that exist. Always exits 0; diagnostics to stderr.

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib.sh" 2>/dev/null || exit 0

RAW="$(read_stdin)"
[ -n "$RAW" ] || exit 0

file_path="$(json_field "$RAW" '.tool_input.file_path')"
[ -n "$file_path" ] || exit 0

case "$file_path" in
  *.bib) : ;;
  *) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

base="$(basename "$file_path")"
findings=""

# --- Duplicate citation keys ----------------------------------------------
# Entry lines look like:  @article{smith2020,
# Extract the key between '{' and the first ','. Ignore @string/@comment/@preamble.
dup_keys="$(
  grep -E '^[[:space:]]*@' "$file_path" 2>/dev/null \
    | sed -E 's/^[[:space:]]*@([[:alnum:]]+)[[:space:]]*\{[[:space:]]*([^,[:space:]]+).*/\1|\2/' \
    | awk -F'|' '
        {
          type = tolower($1)
          key = $2
          if (type == "string" || type == "comment" || type == "preamble") next
          if (key == "") next
          count[key]++
          keys[key] = key
        }
        END {
          for (k in count) if (count[k] > 1) printf "  %s (x%d)\n", k, count[k]
        }
      ' 2>/dev/null
)"
if [ -n "$dup_keys" ]; then
  findings="Duplicate keys in ${base}:
${dup_keys}"
fi

# --- Per-entry brace balance ----------------------------------------------
# Walk the file; at each new top-level @entry, start counting braces. Report
# entries whose '{' and '}' counts do not match.
brace_out="$(
  awk '
    function flush() {
      if (in_entry && (opens != closes)) {
        printf "  entry \"%s\" (line %d): %d { vs %d }\n", cur_key, start_line, opens, closes
      }
    }
    /^[[:space:]]*@/ {
      # Determine entry type to skip @string/@comment/@preamble.
      etype = $0
      sub(/^[[:space:]]*@/, "", etype)
      sub(/[^[:alnum:]].*/, "", etype)
      etype = tolower(etype)
      if (etype == "string" || etype == "comment" || etype == "preamble") {
        flush(); in_entry = 0; next
      }
      # Close out the previous entry before starting a new one.
      flush()
      in_entry = 1
      opens = 0; closes = 0
      start_line = NR
      cur_key = $0
      # Extract key between { and , (best effort).
      if (match(cur_key, /\{[[:space:]]*[^,[:space:]]+/)) {
        cur_key = substr(cur_key, RSTART, RLENGTH)
        sub(/^\{[[:space:]]*/, "", cur_key)
      } else {
        cur_key = "?"
      }
    }
    {
      if (in_entry) {
        n = gsub(/\{/, "{"); opens += n
        n = gsub(/\}/, "}"); closes += n
      }
    }
    END { flush() }
  ' "$file_path" 2>/dev/null
)"
if [ -n "$brace_out" ]; then
  if [ -n "$findings" ]; then
    findings="${findings}

Unbalanced braces in ${base}:
${brace_out}"
  else
    findings="Unbalanced braces in ${base}:
${brace_out}"
  fi
fi

emit_context "PostToolUse" "$findings"
exit 0
