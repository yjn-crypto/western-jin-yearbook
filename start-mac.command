#!/bin/zsh
set -eu
cd "${0:A:h}"
yearbook_python="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ ! -x "$yearbook_python" ]]; then
  yearbook_python="$(command -v python3 || true)"
fi
if [[ -z "$yearbook_python" ]] || ! "$yearbook_python" --version >/dev/null 2>&1; then
  print '需要 Python 3。请在 Codex 中打开此项目并启动本地预览。'
  read -r '?按回车退出。'
  exit 1
fi
exec "$yearbook_python" scripts/preview.py
