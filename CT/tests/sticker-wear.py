"""Regressions for the baked sticker cutout atlas. Run with Python + NumPy + Pillow."""
import importlib.util, json
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bake',ROOT/'tools/bake-wear-textures.py');bake=importlib.util.module_from_spec(spec);spec.loader.exec_module(bake)
a=np.asarray(bake.sticker_damage_atlas());saved=np.asarray(Image.open(ROOT/'assets/wear/worn-sticker-alpha.png'))
assert np.array_equal(a,saved),'Non-deterministic bake'
t=256;axis=(np.arange(t)+.5)/t-.5;x,y=np.meshgrid(axis,axis);qx,qy=np.abs(x)-(.435-.066),np.abs(y)-(.435-.066);pristine=(.066-(np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)))>0
report={}
for version in ['after']:
 atlas=np.asarray(Image.open(ROOT/'assets/wear/worn-sticker-alpha.png'));loss=[];centers=[]
 for i in range(54):
  mask=atlas[i//8*t:(i//8+1)*t,i%8*t:(i%8+1)*t]>=128
  missing=pristine & ~mask;loss.append(float(missing.sum()/pristine.sum()*100))
  if i%9==4:centers.append(loss[-1])
  if version=='after':
   assert mask[80:176,80:176].all(),f'Interior damage on sticker {i}'
   assert not mask[:12,:].any() and not mask[-12:,:].any() and not mask[:,:12].any() and not mask[:,-12:].any(),'Atlas gutter broken'
   # Flood transparent pixels from the tile boundary: no punched-out interior islands.
   empty=~mask;seen=np.zeros_like(mask);seen[0,:]=True;stack=[(0,k) for k in range(t)]
   while stack:
    yy,xx=stack.pop()
    for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
     ny,nx=yy+dy,xx+dx
     if 0<=ny<t and 0<=nx<t and empty[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;stack.append((ny,nx))
   assert np.array_equal(empty,seen),f'Isolated hole on sticker {i}'
 report[version]={'mean_missing_pct':round(float(np.mean(loss)),2),'range_missing_pct':[round(min(loss),2),round(max(loss),2)],'center_mean_missing_pct':round(float(np.mean(centers)),2),'by_sticker':list(np.round(loss,2))}
assert 2 < np.mean(loss) < 8, 'Wear area outside reference-tuned budget'
assert max(loss) < 20, 'Excessive loss on a sticker'
assert np.mean(centers) < 3, 'Excessive center wear'
print(json.dumps(report,indent=2))
print('PASS: deterministic bake; 54 intact interiors; 54 edge-connected masks; atlas gutters')
