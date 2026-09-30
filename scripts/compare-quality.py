"""Deterministic screenshot regression check; excludes only the benchmark UI."""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('reference')
parser.add_argument('candidate')
parser.add_argument('--out')
args=parser.parse_args()
a=np.asarray(Image.open(args.reference).convert('RGB'),dtype=np.float64)/255
b=np.asarray(Image.open(args.candidate).convert('RGB'),dtype=np.float64)/255
if a.shape!=b.shape:raise SystemExit('Viewport mismatch; comparison rejected.')
# The data panel is not part of the rendered scene. All geometry remains in scope.
mask=np.ones(a.shape[:2],dtype=bool);mask[0:220,0:350]=False
def compare(region):
    x,y,w,h=region;aa=a[y:y+h,x:x+w];bb=b[y:y+h,x:x+w];mm=mask[y:y+h,x:x+w]
    ax=aa[mm];bx=bb[mm];mae=float(np.mean(np.abs(ax-bx)))
    # Local 16x16 SSIM captures structure; separate MAE checks color/light response.
    scores=[]
    for yy in range(0,h-15,16):
      for xx in range(0,w-15,16):
        if not mm[yy:yy+16,xx:xx+16].all():continue
        p=aa[yy:yy+16,xx:xx+16];q=bb[yy:yy+16,xx:xx+16]
        p=p@np.array([.2126,.7152,.0722]);q=q@np.array([.2126,.7152,.0722]);up=p.mean();uq=q.mean();vp=p.var();vq=q.var();cov=np.mean((p-up)*(q-uq));scores.append(((2*up*uq+.01**2)*(2*cov+.03**2))/((up**2+uq**2+.01**2)*(vp+vq+.03**2)))
    ssim=float(np.mean(scores)) if scores else 1.0
    return {'ssim':ssim,'ssimLossPercent':(1-ssim)*100,'meanAbsoluteColorErrorPercent':mae*100,'pass':ssim>=.99 and mae<.01}
height,width=a.shape[:2]
result={'reference':args.reference,'candidate':args.candidate,'threshold':'SSIM >= 0.99 and mean absolute RGB error < 1%','wholeScene':compare((0,0,width,height)),'bottleAndInstruments':compare((350,150,min(850,width-350),min(420,height-150))),'limitations':'A raster regression instrument, not proof of photographic realism. No geometry, material maps, wave components, cloud resolution, or render resolution may be reduced for acceptance.'}
result['pass']=result['wholeScene']['pass'] and result['bottleAndInstruments']['pass']
if args.out:Path(args.out).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
