#!/usr/bin/env bash
# session-context.sh — SessionStart hook.
#
# If the working directory looks like a LaTeX project (.latex-agentic.json or
# any *.tex), inject a short context blurb: detected main file, engine, bib
# backend, languages, toolchain availability, Overleaf transport state, and a
# pointer to the relevant skills. Emits nothing when there are no LaTeX signals.
#
# Always exits 0. All diagnostics (if any) go to stderr.

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib.sh" 2>/dev/null || exit 0

# Consume stdin exactly once (we don't need its contents, but must drain it).
RAW="$(read_stdin)"
: "${RAW:=}"

# --- Detect LaTeX signals (cheap, non-recursive) ---------------------------
config="$(find_project_config)"

# Collect *.tex in cwd without recursive find. Glob may not match; guard it.
tex_files=()
shopt -s nullglob 2>/dev/null
for f in ./*.tex; do
  tex_files+=("$f")
done
shopt -u nullglob 2>/dev/null

# No config and no .tex -> not a LaTeX project; stay silent.
if [ -z "$config" ] && [ "${#tex_files[@]}" -eq 0 ]; then
  exit 0
fi

# --- Gather project facts --------------------------------------------------
main_file=""
engine=""
bib_backend=""
languages=""

if [ -n "$config" ]; then
  cfg_json="$(cat "$config" 2>/dev/null)"
  main_file="$(json_field "$cfg_json" '.main')"
  engine="$(json_field "$cfg_json" '.engine')"
  bib_backend="$(json_field "$cfg_json" '.bib.backend')"
  # languages is an array; join with commas via the JSON tool when possible.
  if have_cmd jq; then
    languages="$(printf '%s' "$cfg_json" | jq -r '(.languages // []) | join(", ")' 2>/dev/null)"
  elif have_cmd python3; then
    languages="$(printf '%s' "$cfg_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    langs = d.get("languages", [])
    print(", ".join(str(x) for x in langs) if isinstance(langs, list) else "")
except Exception:
    pass
' 2>/dev/null)"
  fi
fi

# Fall back to the first *.tex as a main-file guess when config is absent/empty.
if [ -z "$main_file" ] && [ "${#tex_files[@]}" -gt 0 ]; then
  # Prefer a file literally named main.tex if present.
  if [ -f "./main.tex" ]; then
    main_file="main.tex"
  else
    main_file="$(basename "${tex_files[0]}")"
  fi
fi

[ -n "$engine" ] || engine="xelatex (default)"
[ -n "$bib_backend" ] || bib_backend="unknown"
[ -n "$languages" ] || languages="unspecified"

# --- Toolchain availability one-liner --------------------------------------
present=()
missing=()
for tool in xelatex latexmk chktex latexindent biber texcount; do
  if have_cmd "$tool"; then
    present+=("$tool")
  else
    missing+=("$tool")
  fi
done
present_str="none"
[ "${#present[@]}" -gt 0 ] && present_str="$(join_list "${present[@]}")"
toolchain_line="Toolchain present: ${present_str}"
if [ "${#missing[@]}" -gt 0 ]; then
  missing_str="$(join_list "${missing[@]}")"
  toolchain_line="${toolchain_line}; missing: ${missing_str}"
fi

# --- Overleaf transport state (presence only; NEVER print secret values) ---
overleaf_transports=()
[ -n "${OVERLEAF_GIT_TOKEN:-}" ] && overleaf_transports+=("git bridge")
[ -n "${OVERLEAF_SESSION_COOKIE:-}" ] && overleaf_transports+=("web API")
if [ "${#overleaf_transports[@]}" -gt 0 ]; then
  overleaf_line="Overleaf transports configured: $(join_list "${overleaf_transports[@]}")"
else
  overleaf_line="Overleaf transports configured: none (set OVERLEAF_GIT_TOKEN or OVERLEAF_SESSION_COOKIE)"
fi

# --- Assemble context blurb ------------------------------------------------
context="latex-agentic detected a LaTeX project.
Main file: ${main_file:-unknown}
Engine: ${engine}
Bib backend: ${bib_backend}
Languages: ${languages}
${toolchain_line}
${overleaf_line}
Skills available: /compile, /fix-errors, /overleaf (and /bibliography, /format, /structure, /i18n, /clean, /wordcount)."

emit_context "SessionStart" "$context"
exit 0
