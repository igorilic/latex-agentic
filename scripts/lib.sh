#!/usr/bin/env bash
# lib.sh — shared helpers for latex-agentic hook scripts.
#
# Sourced (not executed) by session-context.sh, lint-tex.sh, check-bib.sh,
# and compile-guard.sh. Provides:
#   - read_stdin            capture all of stdin into a variable
#   - json_field            extract a field from JSON (jq -> python3 -> node)
#   - emit_context          print a hookSpecificOutput JSON blob (safe encoding)
#   - have_cmd              test command availability
#   - find_project_config   locate .latex-agentic.json in the current dir only
#
# Every helper is defensive: failures degrade to empty output, never an error
# that could surface to the hook runner. Hooks must never block on our bugs.

# have_cmd <name> -> 0 if the command exists on PATH, 1 otherwise.
have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# read_stdin -> echoes everything available on stdin exactly once.
# Callers do:  raw_json="$(read_stdin)"
# Uses `cat` so that an empty / closed stdin yields an empty string cleanly.
read_stdin() {
  cat 2>/dev/null || true
}

# json_field <json> <jq-path>
# Extracts a scalar string from <json> at the given jq-style path
# (e.g. '.tool_input.file_path'). Tries jq, then python3, then node so it
# works when only one of the three is installed. Prints nothing (and the
# field is treated as absent) on any error or null/missing value.
json_field() {
  local json="$1" path="$2" out=""

  if have_cmd jq; then
    out="$(printf '%s' "$json" | jq -r "$path // empty" 2>/dev/null)" || out=""
    printf '%s' "$out"
    return 0
  fi

  if have_cmd python3; then
    # Translate a dotted jq path (.a.b.c) into successive dict lookups.
    out="$(
      JF_PATH="$path" JF_JSON="$json" python3 -c '
import sys, os, json
raw = os.environ.get("JF_JSON", "")
path = os.environ.get("JF_PATH", "")
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)
# Strip a single leading dot, split on dots: ".a.b" -> ["a","b"]
parts = [p for p in path.lstrip(".").split(".") if p != ""]
cur = data
for p in parts:
    if isinstance(cur, dict) and p in cur:
        cur = cur[p]
    else:
        cur = None
        break
if cur is None or isinstance(cur, (dict, list, bool)):
    sys.exit(0)
sys.stdout.write(str(cur))
' 2>/dev/null
    )" || out=""
    printf '%s' "$out"
    return 0
  fi

  if have_cmd node; then
    out="$(
      JF_PATH="$path" JF_JSON="$json" node -e '
try {
  const data = JSON.parse(process.env.JF_JSON || "");
  const path = process.env.JF_PATH || "";
  const parts = path.replace(/^\./, "").split(".").filter(s => s.length);
  let cur = data;
  for (const p of parts) {
    if (cur !== null && typeof cur === "object" && !Array.isArray(cur) && (p in cur)) {
      cur = cur[p];
    } else { cur = null; break; }
  }
  if (cur === null || typeof cur === "object" || typeof cur === "boolean") process.exit(0);
  process.stdout.write(String(cur));
} catch (e) { process.exit(0); }
' 2>/dev/null
    )" || out=""
    printf '%s' "$out"
    return 0
  fi

  # No JSON tool available: silently yield nothing.
  return 0
}

# emit_context <event> <text>
# Prints a single-line hookSpecificOutput JSON object to stdout with the given
# event name and additionalContext text. The text is encoded safely (never
# hand-concatenated) so newlines/quotes/backslashes can't corrupt the JSON.
# No-op when <text> is empty.
emit_context() {
  local event="$1" text="$2"
  [ -n "$text" ] || return 0

  if have_cmd jq; then
    jq -cn --arg ev "$event" --arg ctx "$text" \
      '{hookSpecificOutput: {hookEventName: $ev, additionalContext: $ctx}}' \
      2>/dev/null && return 0
  fi

  if have_cmd python3; then
    EC_EVENT="$event" EC_TEXT="$text" python3 -c '
import os, json, sys
obj = {"hookSpecificOutput": {
    "hookEventName": os.environ.get("EC_EVENT", ""),
    "additionalContext": os.environ.get("EC_TEXT", ""),
}}
sys.stdout.write(json.dumps(obj))
' 2>/dev/null && return 0
  fi

  if have_cmd node; then
    EC_EVENT="$event" EC_TEXT="$text" node -e '
const obj = {hookSpecificOutput: {
  hookEventName: process.env.EC_EVENT || "",
  additionalContext: process.env.EC_TEXT || "",
}};
process.stdout.write(JSON.stringify(obj));
' 2>/dev/null && return 0
  fi

  # No JSON encoder available: stay silent rather than emit unsafe JSON.
  return 0
}

# join_list <item>... -> prints the items joined with ", ".
# (A plain `IFS=', '` join only uses the first IFS character, yielding "a,b".)
join_list() {
  local out="" item
  for item in "$@"; do
    out="${out:+${out}, }${item}"
  done
  printf '%s' "$out"
}

# find_project_config -> prints the path to .latex-agentic.json if it exists in
# the current working directory (non-recursive), otherwise prints nothing.
find_project_config() {
  if [ -f ".latex-agentic.json" ]; then
    printf '%s' "$PWD/.latex-agentic.json"
  fi
}
