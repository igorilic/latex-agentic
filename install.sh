#!/usr/bin/env bash
set -euo pipefail

# latex-agentic installer
# Adds the latex-agentic marketplace and installs the plugin via the Claude CLI.
# Idempotent: safe to re-run to update an existing install.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/igorilic/latex-agentic/main/install.sh | bash
#   ./install.sh --local /path/to/latex-agentic   # install from a local checkout

MARKETPLACE_NAME="latex-agentic"
MARKETPLACE_SOURCE="igorilic/latex-agentic"
PLUGIN_REF="latex-agentic@latex-agentic"
LOCAL_PATH=""

# ---------------------------------------------------------------------------
# Output helpers (colored, no emoji). Colors disabled when stdout isn't a TTY.
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BLUE=$'\033[34m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
else
  C_RESET="" C_BLUE="" C_YELLOW="" C_RED="" C_GREEN=""
fi

info() { printf '%s[info]%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s[ ok ]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
err()  { printf '%s[fail]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [ "$#" -gt 0 ]; do
  case "$1" in
    --local)
      shift
      [ "$#" -gt 0 ] || { err "--local requires a path argument"; exit 1; }
      LOCAL_PATH="$1"
      ;;
    --local=*)
      LOCAL_PATH="${1#--local=}"
      ;;
    -h|--help)
      cat <<'EOF'
latex-agentic installer

Options:
  --local <path>   Install from a local checkout instead of GitHub.
  -h, --help       Show this help and exit.
EOF
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      exit 1
      ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# OS detection (for install hints)
# ---------------------------------------------------------------------------
os_kind() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)
      if [ -r /etc/os-release ] && grep -qiE 'debian|ubuntu' /etc/os-release; then
        echo "debian"
      else
        echo "linux"
      fi
      ;;
    *) echo "other" ;;
  esac
}
OS_KIND="$(os_kind)"

# ---------------------------------------------------------------------------
# Version helpers
# ---------------------------------------------------------------------------
# Returns 0 if $1 (dotted version) >= $2 (dotted version).
version_ge() {
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)" = "$2" ]
}

# ---------------------------------------------------------------------------
# Required dependencies
# ---------------------------------------------------------------------------
require_claude() {
  if ! command -v claude >/dev/null 2>&1; then
    err "The 'claude' CLI was not found on your PATH."
    err "Install Claude Code first: https://claude.com/claude-code"
    exit 1
  fi
  # Best-effort version gate (>= 2.x). Non-fatal if the version can't be parsed.
  local raw major
  raw="$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 || true)"
  if [ -n "$raw" ]; then
    major="${raw%%.*}"
    if [ "$major" -lt 2 ] 2>/dev/null; then
      err "Claude Code >= 2.x is required (found $raw)."
      err "Update Claude Code: https://claude.com/claude-code"
      exit 1
    fi
    ok "claude CLI $raw detected"
  else
    warn "Could not determine the claude CLI version; continuing."
  fi
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    err "Node.js (>= 18) is required for the Overleaf MCP server but was not found."
    case "$OS_KIND" in
      macos)  err "Install with: brew install node" ;;
      debian) err "Install with: sudo apt install nodejs (or use nvm for >= 18)" ;;
      *)      err "Install Node >= 18 from https://nodejs.org" ;;
    esac
    exit 1
  fi
  local nver
  nver="$(node --version 2>/dev/null | sed 's/^v//')"
  if [ -n "$nver" ] && ! version_ge "$nver" "18.0.0"; then
    err "Node >= 18 is required (found $nver)."
    exit 1
  fi
  ok "node ${nver:-unknown} detected"
}

require_git() {
  if ! command -v git >/dev/null 2>&1; then
    err "git is required (Overleaf git transport + marketplace install) but was not found."
    case "$OS_KIND" in
      macos)  err "Install with: xcode-select --install (or brew install git)" ;;
      debian) err "Install with: sudo apt install git" ;;
      *)      err "Install git from https://git-scm.com" ;;
    esac
    exit 1
  fi
  ok "git detected"
}

# ---------------------------------------------------------------------------
# Advisory TeX toolchain check (non-fatal)
# ---------------------------------------------------------------------------
check_tex_tools() {
  local tools="xelatex latexmk chktex latexindent biber texcount"
  local missing=""
  for t in $tools; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done

  if [ -z "$missing" ]; then
    ok "TeX toolchain present (xelatex latexmk chktex latexindent biber texcount)"
    return 0
  fi

  warn "Missing TeX tools:$missing"
  warn "These are optional but recommended for compile/lint/format workflows."
  case "$OS_KIND" in
    macos)
      warn "macOS install options:"
      warn "  Full:    brew install --cask mactex-no-gui"
      warn "  Minimal: brew install --cask basictex && \\"
      warn "           sudo tlmgr update --self && \\"
      warn "           sudo tlmgr install latexmk chktex latexindent biber texcount"
      ;;
    debian)
      warn "Debian/Ubuntu install:"
      warn "  sudo apt install texlive-xetex texlive-latex-extra latexmk chktex biber"
      warn "  (latexindent and texcount ship with texlive-latex-extra/texlive-extra-utils)"
      ;;
    *)
      warn "Install a TeX Live distribution that provides XeLaTeX and the tools above."
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Marketplace + plugin install (idempotent)
# ---------------------------------------------------------------------------
marketplace_known() {
  claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE_NAME"
}

plugin_installed() {
  claude plugin list 2>/dev/null | grep -q "$MARKETPLACE_NAME"
}

install_plugin() {
  local source="$MARKETPLACE_SOURCE"
  if [ -n "$LOCAL_PATH" ]; then
    if [ ! -d "$LOCAL_PATH" ]; then
      err "Local path not found: $LOCAL_PATH"
      exit 1
    fi
    source="$LOCAL_PATH"
    info "Installing from local checkout: $source"
  else
    info "Installing from GitHub: $source"
  fi

  if marketplace_known; then
    info "Marketplace '$MARKETPLACE_NAME' already added; updating."
    claude plugin marketplace update "$MARKETPLACE_NAME"
  else
    info "Adding marketplace '$MARKETPLACE_NAME'."
    claude plugin marketplace add "$source"
  fi

  if plugin_installed; then
    info "Plugin already installed; updating."
    claude plugin update "$PLUGIN_REF"
  else
    info "Installing plugin '$PLUGIN_REF'."
    claude plugin install "$PLUGIN_REF"
  fi

  ok "Plugin '$PLUGIN_REF' is installed."
}

# ---------------------------------------------------------------------------
# Quickstart
# ---------------------------------------------------------------------------
print_quickstart() {
  printf '\n'
  ok "latex-agentic is ready."
  printf '\n'
  info "Quickstart:"
  info "  1. Open Claude Code in a writing folder:  cd ~/writing && claude"
  info "  2. Scaffold a document:                   /new-article   (or /new-resume)"
  info "  3. Compile, then fix:                      /compile  ->  /fix-errors"
  printf '\n'
  info "Overleaf sync is optional. To connect your account (git token or"
  info "session cookie), see docs/OVERLEAF.md:"
  info "  https://github.com/igorilic/latex-agentic/blob/main/docs/OVERLEAF.md"
  printf '\n'
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  info "Installing latex-agentic..."
  require_claude
  require_node
  require_git
  check_tex_tools
  install_plugin
  print_quickstart
}

main "$@"
