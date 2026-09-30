"""Caption original screenshots using logged accounting; preserve originals."""
from pathlib import Path
import json,subprocess,os
ROOT=Path(__file__).resolve().parent.parent
frames=[f for f in json.loads((ROOT/'artifacts/screenshot-accounting.json').read_text()) if f['file'].startswith('progress/')]
out=ROOT/'artifacts/timelapse-fragments';out.mkdir(exist_ok=True)
ffmpeg=os.environ.get('FFMPEG_BIN','ffmpeg')
subprocess.run(['node',str(ROOT/'scripts/render-captions.mjs')],check=True)
concat=[]
for i,f in enumerate(frames):
 t=int(f['elapsedSeconds']);u=f.get('tokens') or {};caption=f"ELAPSED {t//3600:02}h {t//60%60:02}m {t%60:02}s  |  TOTAL {u.get('total_tokens',0):,} TOKENS  |  OUTPUT {u.get('output_tokens',0):,}"
 label=out/f'{i:03}.txt';label.write_text(caption)
 clip=out/f'{i:03}.mp4'
 filters='[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[main];[main][1:v]overlay=0:654'
 subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-loop','1','-i',str(ROOT/f['file']),'-loop','1','-i',str(out/f'{i:03}.png'),'-filter_complex',filters,'-t','2.5','-r','30','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',str(clip)],check=True)
 concat.append(f"file '{clip}'")
listfile=out/'concat.txt';listfile.write_text('\n'.join(concat)+'\n')
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listfile),'-c','copy','-movflags','+faststart',str(ROOT/'public/development-timelapse.mp4')],check=True)
print(f'{len(frames)} original checkpoints; {len(frames)*2.5:.1f}s timelapse.')
