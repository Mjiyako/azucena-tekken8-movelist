"""Conservative, calibrated visual button readings for RyzingSol's four-dot overlay.

These are independent hints, never an approval. Unknown layouts stay unresolved.
"""
import csv
import io
import re
import subprocess
from pathlib import Path
import cv2
import numpy as np
import counters

OFFSETS = {1:(0,0), 2:(10,-5), 3:(5,10), 4:(15,5)}
COLORS = {1:([(140,80,120),(174,255,255)]),2:([(72,70,120),(93,255,255)]),
          3:([(95,55,130),(123,255,255)]),4:([(0,95,120),(12,255,255)])}


def pads(image,author='RyzingSol'):
    h,w = image.shape[:2]
    scale = w / 1536
    fury=author=='TheFURY'
    offsets={1:(0,0),2:(13,0),3:(0,13),4:(13,13)} if fury else OFFSETS
    colors={1:([(80,95,140),(115,255,255)]),2:([(18,110,150),(39,255,255)]),
            3:([(40,100,140),(75,255,255)]),4:([(0,90,140),(15,255,255)])} if fury else COLORS
    top,bottom = (int(h*.102),int(h*.145)) if fury else (int(h*.72),int(h*.88))
    hsv = cv2.cvtColor(image,cv2.COLOR_BGR2HSV)
    crop = hsv[top:bottom]
    candidates = []
    for button,(low,high) in colors.items():
        mask=cv2.inRange(crop,np.array(low),np.array(high))
        n,_,stats,centers=cv2.connectedComponentsWithStats(mask)
        for stat,center in zip(stats[1:],centers[1:]):
            x,y,bw,bh,area=map(int,stat)
            if fury and not .09*w<x<.96*w:
                continue
            if not 5*scale*scale <= area <= 140*scale*scale or not .5 <= bw/max(bh,1) <= 1.7:
                continue
            cx,cy=float(center[0]),float(center[1])+top
            ox,oy=offsets[button]
            anchor=(cx-ox*scale,cy-oy*scale)
            ax,ay=round(anchor[0]),round(anchor[1])
            neighborhood=hsv[max(0,ay-round(14*scale)):min(h,ay+round(22*scale)),max(0,ax-round(12*scale)):min(w,ax+round(24*scale))]
            if not neighborhood.size or (not fury and np.median(neighborhood[:,:,2])>50):
                continue
            good,gray=0,0
            for other,(dx,dy) in offsets.items():
                if other==button: continue
                px,py=round(anchor[0]+dx*scale),round(anchor[1]+dy*scale)
                if not 1<=px<w-1 or not 1<=py<h-1: continue
                value=np.median(hsv[py-1:py+2,px-1:px+2].reshape(-1,3),axis=0)
                inactive=(value[1]<140 and 35<value[2]<125) if fury else (value[1]<65 and 40<value[2]<165)
                active=value[1]>55 and value[2]>120
                gray+=int(inactive);good+=int(inactive or active)
            if good==3 and gray>=2:
                candidates.append({'x':anchor[0],'y':anchor[1],'button':button})
    groups=[]
    for c in sorted(candidates,key=lambda p:p['x']):
        group=next((g for g in groups if abs(g['x']-c['x'])<5*scale and abs(g['y']-c['y'])<5*scale),None)
        if group:
            group['buttons'].add(c['button'])
        else: groups.append({'x':c['x'],'y':c['y'],'buttons':{c['button']}})
    if groups:
        main=max(groups,key=lambda g:sum(abs(g['y']-other['y'])<10*scale for other in groups))
        groups=[g for g in groups if abs(g['y']-main['y'])<10*scale]
    return [{**g,'buttons':sorted(g['buttons'])} for g in groups]


def arrow(image,group,author='RyzingSol'):
    prefix='thefury' if author=='TheFURY' else 'ryzingsol'
    asset=Path(__file__).with_name('profiles')/f'{prefix}-db.png'
    if not asset.exists(): return None
    base=cv2.imread(str(asset),cv2.IMREAD_GRAYSCALE)
    h,w=image.shape[:2];scale=w/1536
    x,y=round(group['x']),round(group['y'])
    x0,x1=max(0,round(x-40*scale)),min(w,round(x-4*scale))
    y0,y1=max(0,round(y-18*scale)),min(h,round(y+20*scale))
    region=cv2.inRange(cv2.cvtColor(image[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY),190,255)
    best=(0,None)
    for degrees,direction in [(0,'db'),(45,'d'),(90,'df'),(135,'f'),(180,'uf'),(225,'u'),(270,'ub'),(315,'b')]:
        rotated=cv2.warpAffine(base,cv2.getRotationMatrix2D((base.shape[1]/2,base.shape[0]/2),degrees,1),
                              (base.shape[1],base.shape[0]),flags=cv2.INTER_NEAREST)
        explicit=asset.with_name(f'{prefix}-{direction}.png')
        if explicit.exists():rotated=cv2.imread(str(explicit),cv2.IMREAD_GRAYSCALE)
        points=cv2.findNonZero(rotated)
        if points is None: continue
        bx,by,bw,bh=cv2.boundingRect(points);rotated=rotated[by:by+bh,bx:bx+bw]
        for factor in [.85,1,1.15]:
            template=cv2.resize(rotated,None,fx=scale*factor,fy=scale*factor,interpolation=cv2.INTER_NEAREST)
            if template.shape[0]>region.shape[0] or template.shape[1]>region.shape[1] or min(template.shape)<3: continue
            score=float(cv2.matchTemplate(region,template,cv2.TM_CCOEFF_NORMED).max())
            if score>best[0]:best=score,direction
    return best[1] if best[0]>.72 else None


def stance_labels(image,author='RyzingSol'):
    tool=counters.executable()
    if not tool:return []
    h,w=image.shape[:2];top=int(h*(.075 if author=='TheFURY' else .72))
    zoom=4
    crop=cv2.resize(image[top:int(h*(.15 if author=='TheFURY' else .88))],None,fx=zoom,fy=zoom)
    gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
    crop=cv2.threshold(gray,180,255,cv2.THRESH_BINARY_INV)[1]
    ok,png=cv2.imencode('.png',crop)
    if not ok:return []
    result=subprocess.run([tool,'stdin','stdout','-l','eng','--psm','11','tsv'],input=png.tobytes(),
        stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=30,check=True)
    words=[]
    for row in csv.DictReader(io.StringIO(result.stdout.decode('utf-8',errors='replace')),delimiter='\t'):
        word=re.sub(r'[^a-z]','',row.get('text','').lower())
        if word:words.append({'word':word,'x':int(row['left'])/zoom,'y':top+(int(row['top'])+int(row['height'])/2)/zoom})
    phrases={('pleasure','time'):'TOM',('chaos','judgement'):'CJM',('hammer','chance'):'HAM',
             ('while','rising'):'WS',('while','standing'):'WS',('while','running'):'WR',('full','crouch'):'FC'}
    labels=[]
    for first in words:
        for phrase,stance in phrases.items():
            if first['word']!=phrase[0]:continue
            second=next((v for v in words if v['word']==phrase[1] and -5*w/1536<v['x']-first['x']<220*w/1536 and abs(v['y']-first['y'])<18*w/1536),None)
            if second:labels.append({'x':first['x'],'y':first['y'],'stance':stance})
    if author=='TheFURY':
        gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
        band=cv2.threshold(gray[int(h*.085):int(h*.145)],180,255,cv2.THRESH_BINARY)[1]
        for asset in Path(__file__).with_name('profiles').glob('thefury-*-label.png'):
            template=cv2.imread(str(asset),cv2.IMREAD_GRAYSCALE)
            template=cv2.resize(template,None,fx=w/1536,fy=w/1536,interpolation=cv2.INTER_NEAREST)
            if template.shape[0]>band.shape[0] or template.shape[1]>band.shape[1]:continue
            scores=cv2.matchTemplate(band,template,cv2.TM_CCOEFF_NORMED)
            ys,xs=np.where(scores>.88)
            positions=[]
            for x,y in sorted(zip(xs,ys),key=lambda p:float(scores[p[1],p[0]]),reverse=True):
                if any(abs(x-prev)<20*w/1536 for prev in positions):continue
                positions.append(x)
                labels.append({'x':float(x),'y':float(int(h*.085)+y+template.shape[0]/2),
                               'stance':asset.name.split('-')[1]})
    return labels


def read(frame,author):
    if author not in ('RyzingSol','TheFURY'):
        return {'profile':None,'groups':[],'suggestion':None,'note':'No calibrated symbol profile for this source; use frame evidence and review the model transcription.'}
    image=cv2.imread(str(frame))
    if image is None:return {'profile':None,'groups':[],'suggestion':None,'note':'Image could not be decoded.'}
    groups=pads(image,author);labels=stance_labels(image,author);w=image.shape[1]
    parts=[]
    hsv=cv2.cvtColor(image,cv2.COLOR_BGR2HSV)
    green=cv2.inRange(hsv,np.array((48,125,130)),np.array((70,255,255)))
    _,_,stats,centers=cv2.connectedComponentsWithStats(green)
    separators=[tuple(c) for s,c in zip(stats[1:],centers[1:]) if 3*w/1536<=s[2]<=10*w/1536 and 7*w/1536<=s[3]<=18*w/1536]
    previous=-1e9
    for group in groups:
        direction=arrow(image,group,author)
        stance=next((v['stance'] for v in reversed(labels) if previous+8*w/1536<v['x']<group['x'] and abs(v['y']-group['y'])<16*w/1536),None)
        group.update(direction=direction,stance=stance)
        if parts:
            separated=any(previous+18*w/1536<cx<group['x']-5*w/1536 and abs(cy-group['y'])<18*w/1536 for cx,cy in separators)
            parts.append(' ► ' if separated else ',')
        parts.append((stance+'.' if stance else '')+(direction+'+' if direction else '')+'+'.join(map(str,group['buttons'])))
        previous=group['x']
    return {'profile':author+' four-dot overlay (calibrated sample)', 'groups':groups,
        'suggestion':''.join(parts) if parts else None,
        'note':'Visual hint only. Check separators versus strings, holds, delays, whiffs, Heat actions and all missing labels.'}
