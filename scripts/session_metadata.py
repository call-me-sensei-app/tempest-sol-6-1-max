"""Explicit local session input; never embed a developer's private log path."""
import os
from pathlib import Path


def session_log_path():
    value = os.environ.get('CODEX_SESSION_LOG')
    if not value:
        raise SystemExit('Set CODEX_SESSION_LOG to your own local session JSONL before running accounting tools. The application and saved reports do not require it.')
    path = Path(value).expanduser()
    if not path.is_file():
        raise SystemExit('CODEX_SESSION_LOG does not point to a readable local file.')
    return path
