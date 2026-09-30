"""Read this task's usage metadata only; persist exact checkpoint accounting."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from session_metadata import session_log_path

ROOT = Path(__file__).resolve().parent.parent
SESSION = session_log_path()

parser = argparse.ArgumentParser()
parser.add_argument('--stage', required=True)
parser.add_argument('--frame')
parser.add_argument('--final', action='store_true')
args = parser.parse_args()
started = None
usage = None
usage_at = None
for line in SESSION.open():
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        continue
    started = started or event.get('timestamp')
    payload = event.get('payload', {})
    if event.get('type') == 'event_msg' and payload.get('type') == 'token_count':
        info = payload.get('info') or {}
        if info.get('total_token_usage'):
            usage = info['total_token_usage']
            usage_at = event.get('timestamp')
now = datetime.now(timezone.utc)
start = datetime.fromisoformat(started.replace('Z', '+00:00'))
record = {
    'startedAt': started,
    'capturedAt': now.isoformat(),
    'elapsedSeconds': round((now-start).total_seconds(), 1),
    'stage': args.stage,
    'complete': args.final,
    'frame': args.frame,
    'tokenUsageAsOf': usage_at,
    'tokens': usage,
    'uncachedInputTokens': usage['input_tokens']-usage.get('cached_input_tokens', 0) if usage else None,
    'note': 'Cumulative input re-counts context on each request and includes cached input. Reasoning tokens are a subset of output. Snapshot excludes tokens generated after the latest usage event.'
}
(ROOT/'public'/'development.json').write_text(json.dumps(record, indent=2)+'\n')
manifest = ROOT/'progress'/'manifest.json'
data = json.loads(manifest.read_text()) if manifest.exists() else {'frames': [], 'accounting': record['note']}
if args.frame:
    data['frames'] = [r for r in data['frames'] if r.get('frame') != args.frame]
    data['frames'].append(record)
if args.final:
    data['final'] = record
manifest.write_text(json.dumps(data, indent=2)+'\n')
print(json.dumps(record, indent=2))
