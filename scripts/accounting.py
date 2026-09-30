"""Derive usage checkpoints and hypothetical Standard API costs from metadata only."""
import json
from pathlib import Path
from datetime import datetime,timezone
from session_metadata import session_log_path
ROOT=Path(__file__).resolve().parent.parent
SESSION=session_log_path()
def records():
    events=[];started=None;settings=[]
    for line in SESSION.open():
        e=json.loads(line);started=started or e['timestamp'];p=e.get('payload',{})
        if e['type']=='event_msg' and p.get('type')=='token_count' and p.get('info',{}).get('total_token_usage'):events.append((e['timestamp'],p['info']))
        if e['type']=='turn_context':settings.append({k:p.get(k) for k in ['model','effort','service_tier']})
    return started,events,settings
started,events,settings=records();start=datetime.fromisoformat(started.replace('Z','+00:00'))
previous={};cost={'uncachedInput':0.,'cachedInput':0.,'cacheWrites':0.,'output':0.};long_requests=0;unique=0;max_input=0;long=False
for stamp,info in events:
    usage=info['total_token_usage'];delta={k:usage.get(k,0)-previous.get(k,0) for k in usage}
    if any(v<0 for v in delta.values()):raise RuntimeError('Usage counter reset; do not silently misprice.')
    if not delta.get('total_tokens',0):continue
    size=info.get('last_token_usage',{}).get('input_tokens',delta.get('input_tokens',0));max_input=max(max_input,size)
    if delta.get('input_tokens',0)>0:long=size>272000;unique+=1;long_requests+=int(long)
    multiplier=2 if long else 1;out_multiplier=1.5 if long else 1
    cached=delta.get('cached_input_tokens',0);writes=delta.get('cache_write_input_tokens',0);uncached=delta.get('input_tokens',0)-cached-writes
    cost['uncachedInput']+=uncached*2/1e6*multiplier;cost['cachedInput']+=cached*.1/1e6*multiplier;cost['cacheWrites']+=writes*2.5/1e6*multiplier;cost['output']+=delta.get('output_tokens',0)*10/1e6*out_multiplier
    previous=usage
now=datetime.now(timezone.utc)
result={'startedAt':started,'generatedAt':now.isoformat(),'elapsedSeconds':(now-start).total_seconds(),'usageAsOf':events[-1][0],'tokens':previous,'uncachedInputTokens':previous['input_tokens']-previous.get('cached_input_tokens',0)-previous.get('cache_write_input_tokens',0),'model':'GPT 6.1 Sol','reasoningEffort':'Max Effort','mode':'Not Fast','observedSettings':list({json.dumps(s,sort_keys=True) for s in settings}),'hypotheticalStandardApiCostUsd':sum(cost.values()),'costBreakdownUsd':cost,'requests':unique,'longContextRequests':long_requests,'maxPromptInputTokens':max_input,'pricingSource':'https://developers.openai.com/api/docs/pricing','pricingVerifiedAt':'2026-09-30','ratesPerMillion':{'short':{'uncached':2,'cached':.1,'cacheWrite':2.5,'output':10},'long':{'uncached':4,'cached':.2,'cacheWrite':5,'output':15}},'notes':['Hypothetical model-token API cost, not a Codex subscription charge or invoice.','Input tokens re-count context on each request. Cached input is included in input totals.','Reasoning tokens are included in output; never billed a second time.','Long context rates apply to the entire request when its input exceeds 272,000 tokens.','Snapshot excludes unreported in-flight tokens and subsequent final response. External tool, hosting, tax and hardware costs are excluded.']}
(ROOT/'artifacts'/'accounting.json').write_text(json.dumps(result,indent=2)+'\n')
frames=[]
for p in sorted((ROOT/'progress').glob('*.jpg'))+sorted((ROOT/'artifacts'/'benchmarks').glob('*.jpg'))+sorted((ROOT/'artifacts'/'verification').glob('*.jpg')):
    at=datetime.fromtimestamp(p.stat().st_mtime,timezone.utc);stamp=at.isoformat();info=next(((t,i) for t,i in reversed(events) if datetime.fromisoformat(t.replace('Z','+00:00'))<=at),None)
    frames.append({'file':str(p.relative_to(ROOT)),'capturedAt':stamp,'elapsedSeconds':(at-start).total_seconds(),'usageAsOf':info[0] if info else None,'tokens':info[1]['total_token_usage'] if info else None,'method':'Filesystem screenshot-save timestamp; last logged usage snapshot at or before that timestamp.'})
frames.sort(key=lambda f:f['capturedAt'])
(ROOT/'artifacts'/'screenshot-accounting.json').write_text(json.dumps(frames,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['elapsedSeconds','tokens','hypotheticalStandardApiCostUsd','requests','longContextRequests','maxPromptInputTokens','observedSettings']},indent=2))
