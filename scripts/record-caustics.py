"""Account for this follow-up without altering the original final report."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from session_metadata import session_log_path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts' / 'caustics'
SESSION = session_log_path()
p = argparse.ArgumentParser()
p.add_argument('--stage', required=True)
p.add_argument('--frame', required=True)
p.add_argument('--final', action='store_true')
a = p.parse_args()
events = []
for line in SESSION.open():
    e = json.loads(line)
    payload = e.get('payload', {})
    if e.get('type') == 'event_msg' and payload.get('type') == 'token_count':
        usage = (payload.get('info') or {}).get('total_token_usage')
        if usage:
            events.append((e['timestamp'], usage))

ledger = OUT / 'checkpoints.json'
data = json.loads(ledger.read_text()) if ledger.exists() else {'startedAt': datetime.fromtimestamp((OUT/'00-before.jpg').stat().st_mtime, timezone.utc).isoformat(), 'frames': []}
at = datetime.fromtimestamp((OUT/a.frame).stat().st_mtime, timezone.utc)
stamp, usage = next(((stamp, usage) for stamp, usage in reversed(events) if datetime.fromisoformat(stamp.replace('Z', '+00:00')) <= at), (None, None))
if 'baselineTokens' not in data:
    data['baselineTokens'] = usage
baseline = data['baselineTokens'] or {}
delta = {k: v-baseline.get(k, 0) for k, v in (usage or {}).items()}
record = {'frame': a.frame, 'stage': a.stage, 'capturedAt': at.isoformat(), 'elapsedSeconds': (at-datetime.fromisoformat(data['startedAt'])).total_seconds(), 'tokenUsageAsOf': stamp, 'cumulativeTaskTokens': usage, 'followupTokensSinceFirstCapture': delta}
data['frames'] = [r for r in data['frames'] if r['frame'] != a.frame] + [record]
if a.final:
    data['final'] = record
data['note'] = 'Follow-up elapsed time is measured since the first saved screenshot. Input totals include repeated cached context. Reasoning tokens are a subset of output. Usage is the latest logged metadata at or before capture, not an estimate of unreported in-flight tokens. Original final-report snapshot remains unchanged.'
ledger.write_text(json.dumps(data, indent=2)+'\n')
(ROOT/'public'/'caustics-progress.json').write_text(json.dumps({**record, 'complete': a.final, 'note': data['note']}, indent=2)+'\n')
print(json.dumps(record, indent=2))
