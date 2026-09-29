#!/usr/bin/env python3
"""
ARAEA — AI Generative Visual Server  v2
========================================
Streams AI-generated frames to the frontend via WebSocket.

Model tiers (auto-detected, best first):
  Tier 1  SDXL-Turbo       GPU  ~200ms   pip install diffusers transformers accelerate
  Tier 2  SD 1.5 + LCM     GPU  ~350ms   same
  Tier 3  StyleGAN2 ONNX   CPU  ~120ms   pip install onnxruntime + model download
  Tier 4  5 Procedural Modes  CPU  ~40ms  numpy only — ALWAYS WORKS:
           • Reaction-Diffusion  (Gray-Scott organic patterns)
           • Voronoi Plasma      (cellular crystal growth)
           • Fractal Storm       (plasma + Mandelbrot boundary)
           • Particle Nebula     (3-layer force field simulation)
           • Neural Dream        (deep-dream style iterative synthesis)

Usage:
  python ai_visual_server.py            # auto-detect
  python ai_visual_server.py --tier 4   # force procedural
  python ai_visual_server.py --mode rd  # force specific mode (rd/voronoi/fractal/nebula/dream)
  python ai_visual_server.py --res 256  # smaller = faster
"""

import asyncio, websockets, json, base64, time, logging, argparse
import threading, queue, math, os
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

logging.basicConfig(level=logging.INFO, format="[AI-VIS] %(levelname)s %(message)s")
log = logging.getLogger("araea_ai")

# ── Optional ML ───────────────────────────────────────────
TORCH_OK=False; DIFFUSERS_OK=False; ONNX_OK=False
try:
    import torch; TORCH_OK=True
    log.info(f"PyTorch {torch.__version__} — GPU={torch.cuda.is_available()}")
except ImportError: log.info("PyTorch not found")
try:
    from diffusers import AutoPipelineForImage2Image, LCMScheduler
    DIFFUSERS_OK=True
except ImportError: log.info("diffusers not found — pip install diffusers transformers accelerate")
try:
    import onnxruntime as ort; ONNX_OK=True
    log.info(f"ONNX Runtime {ort.__version__}")
except ImportError: log.info("onnxruntime not found")

# ── Prompt builder ────────────────────────────────────────
MOOD_P={"euphoric":"euphoric neon aurora plasma, electric solar flare, vivid chromatic explosion",
        "happy":"golden sunrise celebration, warm sparkling light, prismatic rainbow rays",
        "calm":"serene bioluminescent ocean depths, teal caustics, peaceful void",
        "melancholic":"deep violet nebula longing, cosmic dust trails, twilight dream",
        "tense":"crimson electrical storm, jagged plasma, dangerous discharge, magma",
        "sad":"deep blue melancholy mist, cerulean rain fractal, ocean solitude",
        "neutral":"silver gradient geometry, harmonic abstract sphere"}
SCENE_P={"cosmic":"deep space nebula, star formation, galactic core","party":"festival laser grid, rave explosion",
          "focus":"sacred geometry, crystalline lattice, mandala","sleep":"dream aurora, lunar glow, hypnagogic",
          "workout":"kinetic energy, heat distortion red, explosive force","jazz":"warm amber smoke, brass reflection",
          "relax":"emerald forest light, water caustics, botanical","wakeup":"golden hour sunrise, morning mist"}
NEGATIVE="text, words, letters, watermark, nsfw, face, person, body, realistic photo, blurry"

def build_prompt(mood,scene,energy,bpm):
    parts=[MOOD_P.get(mood,"abstract luminous art"),SCENE_P.get(scene or "",""),
           "intense dynamic pulsating" if energy>.7 else "flowing rhythmic" if energy>.4 else "gentle soft ambient",
           "rapid motion" if (bpm or 0)>140 else "rhythmic beat" if (bpm or 0)>100 else "slow drift",
           "abstract generative art, digital painting, no text, 8k masterpiece"]
    return ", ".join(p for p in parts if p)

# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════
def norm01(a):
    mn,mx=a.min(),a.max()
    return (a-mn)/(mx-mn+1e-8)

def hsl_colormap(n=256, hue=200.0, sat=1.0):
    """Build n-entry RGB colormap centered on hue."""
    cm=np.zeros((n,3),np.uint8)
    for i in range(n):
        t=i/255.0
        l=t*.65 if t<.5 else .3+t*.65
        h=((hue+t*40)%360)/360.0; s=sat*(1-t*.3)
        def h2(p,q,t2):
            if t2<0: t2+=1
            if t2>1: t2-=1
            if t2<1/6: return p+(q-p)*6*t2
            if t2<.5:  return q
            if t2<2/3: return p+(q-p)*(2/3-t2)*6
            return p
        q2=l*(1+s) if l<.5 else l+s-l*s; p2=2*l-q2
        cm[i]=[int(h2(p2,q2,h+1/3)*255),int(h2(p2,q2,h)*255),int(h2(p2,q2,h-1/3)*255)]
    return cm

def apply_colormap(arr, cm):
    """arr: float32 H×W in [0,1] → H×W×3 uint8"""
    idx=np.clip((arr*255).astype(np.int32),0,255)
    return cm[idx]

def vignette(w,h,strength=0.55):
    yy,xx=np.mgrid[0:h,0:w]
    cx,cy=w/2,h/2
    d=np.sqrt(((xx-cx)/cx)**2+((yy-cy)/cy)**2)
    return np.clip(1-d*strength,0,1).astype(np.float32)

def screen_blend(a,b,mix=0.5):
    return np.clip(1-(1-a)*(1-b*mix),0,1)

# ══════════════════════════════════════════════════════════
# VISUAL MODE 1 — REACTION DIFFUSION (Gray-Scott)
# ══════════════════════════════════════════════════════════
class RDMode:
    def __init__(self,w,h):
        self.w,self.h=w,h
        self.u=np.ones((h,w),np.float32)
        self.v=np.zeros((h,w),np.float32)
        rng=np.random.default_rng(7)
        r=max(8,w//18)
        cx,cy=w//2,h//2
        self.v[cy-r:cy+r,cx-r:cx+r]=0.25+rng.random((2*r,2*r),dtype=np.float32)*.06
        self.u[cy-r:cy+r,cx-r:cx+r]=0.50+rng.random((2*r,2*r),dtype=np.float32)*.06
        self._last_beat=0; self._t=0

    def step(self,f=.055,k=.062,Du=.16,Dv=.08,n=8):
        u,v=self.u,self.v
        for _ in range(n):
            Lu=(np.roll(u,1,0)+np.roll(u,-1,0)+np.roll(u,1,1)+np.roll(u,-1,1)-4*u)
            Lv=(np.roll(v,1,0)+np.roll(v,-1,0)+np.roll(v,1,1)+np.roll(v,-1,1)-4*v)
            uvv=u*v*v
            u+=Du*Lu-uvv+f*(1-u); v+=Dv*Lv+uvv-(f+k)*v
        np.clip(u,0,1,out=u); np.clip(v,0,1,out=v)
        self._t+=1

    def inject(self,amount=.1):
        rng=np.random.default_rng()
        nw=max(4,int(self.w*.1))
        x=rng.integers(0,self.w-nw); y=rng.integers(0,self.h-nw)
        self.v[y:y+nw,x:x+nw]+=rng.random((nw,nw),dtype=np.float32)*amount
        np.clip(self.v,0,1,out=self.v)

    def render(self,audio,hue,vign):
        bass=float(audio.get("bass",.3)); energy=float(audio.get("energy",.5))
        beat=float(audio.get("beat",0));  mid=float(audio.get("mid",.3))
        f=.040+bass*.032; k=.058+energy*.018; Du=.14+mid*.04
        n=max(4,int(7+energy*14)); self.step(f=f,k=k,Du=Du,n=n)
        if beat>.72 and self._t-self._last_beat>3:
            self.inject(.08+bass*.14); self._last_beat=self._t
        v_img=Image.fromarray((self.v*255).astype(np.uint8))
        v_up=np.array(v_img.resize((self.w,self.h),Image.LANCZOS),np.float32)/255
        cm=hsl_colormap(256,hue)
        rgb=apply_colormap(v_up,cm).astype(np.float32)/255
        if beat>.6:
            fc=np.array([cm[220,0]/255,cm[220,1]/255,cm[220,2]/255])
            rgb=np.clip(rgb+fc*(beat-.6)*.22,0,1)
        rgb*=vign[:,:,None]
        return rgb

# ══════════════════════════════════════════════════════════
# VISUAL MODE 2 — VORONOI PLASMA
# ══════════════════════════════════════════════════════════
class VoronoiMode:
    def __init__(self,w,h):
        self.w,self.h=w,h
        self._t=0; self._last_beat=0
        rng=np.random.default_rng(13)
        self.pts=rng.random((48,2),dtype=np.float32)       # seed points [0,1]
        self.vel=rng.standard_normal((48,2)).astype(np.float32)*.0004
        ys,xs=np.mgrid[0:h,0:w]
        self._ys=(ys/h).astype(np.float32); self._xs=(xs/w).astype(np.float32)

    def _move_pts(self,speed_mult=1.0):
        self.pts+=self.vel*speed_mult
        # Wrap around edges
        self.pts%=1.0

    def render(self,audio,hue,vign):
        energy=float(audio.get("energy",.5)); beat=float(audio.get("beat",0))
        bass=float(audio.get("bass",.3)); mid=float(audio.get("mid",.3))
        self._t+=1
        spd=0.7+energy*1.8+(beat>.7)*2.5
        self._move_pts(spd)
        if beat>.75 and self._t-self._last_beat>3:
            # Scatter a few points
            rng=np.random.default_rng(self._t)
            idx=rng.integers(0,len(self.pts),6)
            self.pts[idx]+=rng.standard_normal((6,2)).astype(np.float32)*.08
            self.pts%=1.0; self._last_beat=self._t

        xs=self._xs; ys=self._ys
        # Vectorised: dist to each point
        dx=xs[:,:,None]-self.pts[None,None,:,1]
        dy=ys[:,:,None]-self.pts[None,None,:,0]
        dists=np.sqrt(dx**2+dy**2)          # H×W×N
        d1=dists.min(axis=2)                # nearest
        idx2=np.argsort(dists,axis=2)[:,:,:2]
        d2=dists[np.arange(self.h)[:,None,None], np.arange(self.w)[None,:,None], idx2[:,:,1:2]].squeeze(2)
        # Edge = difference between 1st and 2nd nearest
        edge=np.clip((d2-d1)*8,0,1)
        field=norm01(d1+edge*.5+np.sin(d1*20+self._t*.04)*mid*.3)
        # Hue shifts per Voronoi cell
        cell_hues=(self.pts[:,0]*180+self.pts[:,1]*60)
        # Assign each pixel its cell hue
        nearest_cell=dists.argmin(axis=2)
        px_hue=(hue+cell_hues[nearest_cell])%360
        # Build per-pixel color
        r,g,b=np.zeros((self.h,self.w)),np.zeros((self.h,self.w)),np.zeros((self.h,self.w))
        for hi in range(0,360,15):
            mask=np.abs(px_hue-hi)<8
            if not mask.any(): continue
            cm=hsl_colormap(256,(hue+hi)%360)
            rgb_tmp=apply_colormap(field,cm).astype(np.float32)/255
            r[mask]+=rgb_tmp[:,:,0][mask]
            g[mask]+=rgb_tmp[:,:,1][mask]
            b[mask]+=rgb_tmp[:,:,2][mask]
        rgb=np.stack([r,g,b],axis=2)
        # Edge glow
        ec=np.array([*hsl_colormap(1,hue)[0]/255])
        rgb=np.clip(rgb+ec*edge[:,:,None]*(bass*1.2),0,1)
        rgb*=vign[:,:,None]
        return rgb

# ══════════════════════════════════════════════════════════
# VISUAL MODE 3 — FRACTAL STORM (plasma + boundary walking)
# ══════════════════════════════════════════════════════════
class FractalMode:
    def __init__(self,w,h):
        self.w,self.h=w,h; self._t=0
        # Precompute coordinate grids
        x=np.linspace(-2.2,2.2,w); y=np.linspace(-2.2,2.2,h)
        self._xx,self._yy=np.meshgrid(x.astype(np.float32),y.astype(np.float32))
        # Mandelbrot escape time (precomputed, update slowly)
        self._mb=self._mandelbrot(0,0,2.2)
        self._mb_age=0

    def _mandelbrot(self,cx,cy,zoom=2.2,iters=40):
        x=np.linspace(cx-zoom,cx+zoom,self.w,dtype=np.float32)
        y=np.linspace(cy-zoom,cy+zoom,self.h,dtype=np.float32)
        xx,yy=np.meshgrid(x,y)
        c=xx+1j*yy; z=np.zeros_like(c)
        escape=np.zeros(c.shape,np.float32)
        for i in range(iters):
            mask=np.abs(z)<4
            z[mask]=z[mask]**2+c[mask]
            escape[mask]=i
        return norm01(escape)

    def render(self,audio,hue,vign):
        energy=float(audio.get("energy",.5)); beat=float(audio.get("beat",0))
        bass=float(audio.get("bass",.3));  mid=float(audio.get("mid",.3))
        self._t+=1
        t=self._t*.016
        # Animated plasma
        xx,yy=self._xx,self._yy
        p=(np.sin(xx*3+t)+np.sin(yy*3+t*1.1)+
           np.sin((xx+yy)*2+t*1.5)+
           np.sin(np.sqrt(np.clip(xx**2+yy**2,0,None))*4-t*1.8))/4
        p=norm01(p)
        # Mix with Mandelbrot (slowly shift zoom)
        self._mb_age+=1
        if self._mb_age>90:
            zoom=2.0+math.sin(self._t*.007)*1.0
            cx=math.sin(self._t*.003)*.5; cy=math.cos(self._t*.005)*.4
            self._mb=self._mandelbrot(cx,cy,zoom); self._mb_age=0
        blend=.35+energy*.25+bass*.2
        field=norm01(p*(1-blend)+self._mb*blend)
        # Edge sharpening on high energy
        if energy>.5:
            edges=np.abs(np.gradient(field)[0])+np.abs(np.gradient(field)[1])
            field=np.clip(field+edges*energy*.4,0,1)
        # Beat invert pulse
        if beat>.7:
            field=np.clip(field+(1-field*2)*(beat-.7)*.35,0,1)
        cm=hsl_colormap(256,(hue+math.sin(self._t*.02)*30)%360)
        rgb=apply_colormap(field,cm).astype(np.float32)/255
        # Second layer: shifted hue at low alpha
        cm2=hsl_colormap(256,(hue+120)%360)
        rgb2=apply_colormap(1-field,cm2).astype(np.float32)/255
        rgb=screen_blend(rgb,rgb2,mid*.45)
        rgb*=vign[:,:,None]
        return rgb

# ══════════════════════════════════════════════════════════
# VISUAL MODE 4 — PARTICLE NEBULA (force field sim)
# ══════════════════════════════════════════════════════════
class NebulaMode:
    N=1200
    def __init__(self,w,h):
        self.w,self.h=w,h; self._t=0; self._last_beat=0
        rng=np.random.default_rng(42)
        self.x=(rng.random(self.N)*w).astype(np.float32)
        self.y=(rng.random(self.N)*h).astype(np.float32)
        self.vx=rng.standard_normal(self.N).astype(np.float32)*.4
        self.vy=rng.standard_normal(self.N).astype(np.float32)*.4
        self.hues=rng.random(self.N).astype(np.float32)*360
        self.life=rng.random(self.N).astype(np.float32)
        self._canvas=np.zeros((h,w,3),np.float32)

    def render(self,audio,hue,vign):
        energy=float(audio.get("energy",.5)); beat=float(audio.get("beat",0))
        bass=float(audio.get("bass",.3)); mid=float(audio.get("mid",.3))
        hi=float(audio.get("hi",.2)); self._t+=1; t=self._t*.016
        # Fade canvas
        fade=.06+beat*.04
        self._canvas*=(1-fade)
        np.clip(self._canvas,0,1,out=self._canvas)

        # Force field: curl noise pattern
        fx=np.sin(self.x/self.w*6+t)*energy*1.8+np.cos(self.y/self.h*4+t*.7)*bass
        fy=np.cos(self.y/self.h*5+t*.8)*energy*1.8+np.sin(self.x/self.w*3-t*.6)*mid
        # Attractor pulls toward center gently
        cx2=self.w/2; cy2=self.h/2
        ax=(cx2-self.x)/self.w*.15; ay=(cy2-self.y)/self.h*.15
        self.vx=self.vx*.97+fx*.06+ax
        self.vy=self.vy*.97+fy*.06+ay
        # Beat burst from center
        if beat>.75 and self._t-self._last_beat>4:
            self._last_beat=self._t
            dist=np.sqrt((self.x-cx2)**2+(self.y-cy2)**2)+1
            self.vx+=(self.x-cx2)/dist*beat*6
            self.vy+=(self.y-cy2)/dist*beat*6
        self.x+=self.vx; self.y+=self.vy
        # Wrap
        self.x%=self.w; self.y%=self.h
        # Age
        self.life-=.004+hi*.003
        dead=self.life<=0
        if dead.any():
            rng=np.random.default_rng(self._t)
            n=dead.sum()
            self.x[dead]=rng.random(n)*self.w
            self.y[dead]=rng.random(n)*self.h
            self.vx[dead]=rng.standard_normal(n)*.5
            self.vy[dead]=rng.standard_normal(n)*.5
            self.hues[dead]=(hue+rng.random(n)*120)%360
            self.life[dead]=rng.random(n)*.8+.3
        # Paint particles
        xi=np.clip(self.x.astype(np.int32),0,self.w-1)
        yi=np.clip(self.y.astype(np.int32),0,self.h-1)
        # Per-particle color from hue
        ph=self.hues
        r=(.5+np.sin(ph/180*math.pi)*.5)*self.life*1.4
        g=(.5+np.sin((ph+120)/180*math.pi)*.5)*self.life
        b=(.5+np.sin((ph+240)/180*math.pi)*.5)*self.life*1.2
        np.add.at(self._canvas[:,:,0],np.stack([yi,xi],axis=1).T if False else (yi,xi),r*.18)
        np.add.at(self._canvas[:,:,1],(yi,xi),g*.15)
        np.add.at(self._canvas[:,:,2],(yi,xi),b*.18)
        np.clip(self._canvas,0,1,out=self._canvas)
        rgb=self._canvas.copy()*vign[:,:,None]
        # Bloom pass via PIL
        img=Image.fromarray((rgb*255).astype(np.uint8))
        blur=img.filter(ImageFilter.GaussianBlur(radius=3))
        blurred=np.array(blur,np.float32)/255
        rgb=np.clip(screen_blend(rgb,blurred,.55),0,1)
        return rgb

# ══════════════════════════════════════════════════════════
# VISUAL MODE 5 — NEURAL DREAM (iterative synthesis)
# ══════════════════════════════════════════════════════════
class NeuralDreamMode:
    def __init__(self,w,h):
        self.w,self.h=w,h; self._t=0
        rng=np.random.default_rng(99)
        self._field=rng.random((h,w),dtype=np.float32)*.3
        self._phase=rng.random((h,w),dtype=np.float32)*math.pi*2
        self._last_beat=0

    def _convolve_approx(self,a,k=5):
        """Approximate Gaussian blur using roll ops — no scipy needed."""
        out=a.copy()
        for d in range(1,k//2+1):
            w2=1.0/(2*d+1)
            out=out*w2+np.roll(a,d,0)*w2*.5+np.roll(a,-d,0)*w2*.5
        return out

    def render(self,audio,hue,vign):
        energy=float(audio.get("energy",.5)); beat=float(audio.get("beat",0))
        bass=float(audio.get("bass",.3)); mid=float(audio.get("mid",.3))
        self._t+=1; t=self._t*.016
        # Update phase with frequency-domain pattern
        self._phase+=.025+energy*.04
        # Self-referential update — creates feedback loop
        blurred=self._convolve_approx(self._field,5)
        laplacian=(np.roll(self._field,1,0)+np.roll(self._field,-1,0)+
                   np.roll(self._field,1,1)+np.roll(self._field,-1,1)-4*self._field)
        self._field+=laplacian*(.12+mid*.08)+np.sin(self._field*math.pi*2+self._phase)*.03*bass
        self._field=norm01(self._field)
        # Inject beat energy
        if beat>.68 and self._t-self._last_beat>3:
            cx2,cy2=self.w//2,self.h//2; r=max(10,int(self.w*.12))
            self._field[cy2-r:cy2+r,cx2-r:cx2+r]=(
                1-self._field[cy2-r:cy2+r,cx2-r:cx2+r])
            self._last_beat=self._t
        # Frequency-modulated color: two hue layers
        h1=(hue+math.sin(t*.3)*25)%360
        h2=(hue+120+math.cos(t*.2)*20)%360
        cm1=hsl_colormap(256,h1); cm2=hsl_colormap(256,h2)
        rgb1=apply_colormap(self._field,cm1).astype(np.float32)/255
        rgb2=apply_colormap(1-self._field,cm2).astype(np.float32)/255
        # Luminance-based blend
        lum=self._field[:,:,None]
        rgb=rgb1*lum+rgb2*(1-lum)*.6
        rgb=np.clip(rgb,0,1)
        # Edge detection → neon outline
        dx=np.abs(np.roll(self._field,1,1)-np.roll(self._field,-1,1))
        dy=np.abs(np.roll(self._field,1,0)-np.roll(self._field,-1,0))
        edges=np.clip((dx+dy)*3,0,1)
        ec=np.array([cm1[200,0]/255,cm1[200,1]/255,cm1[200,2]/255])
        rgb=np.clip(rgb+ec*edges[:,:,None]*(energy*.6+.2),0,1)
        rgb*=vign[:,:,None]
        return rgb

# ══════════════════════════════════════════════════════════
# TIER 4 — PROCEDURAL ORCHESTRATOR
# ══════════════════════════════════════════════════════════
MOOD_HUE={"euphoric":0,"happy":38,"calm":196,"melancholic":265,"tense":345,"sad":218,"neutral":200}
SCENE_HUE={"party":32,"focus":210,"sleep":240,"wakeup":30,"workout":4,"cosmic":276,"jazz":35,"relax":168}
SCENE_MODE={"cosmic":"nebula","party":"fractal","focus":"dream","sleep":"rd",
             "workout":"fractal","jazz":"voronoi","relax":"rd","wakeup":"voronoi"}

class ProceduralOrchestrator:
    MODE_NAMES=["rd","voronoi","fractal","nebula","dream"]

    def __init__(self,w=512,h=512,force_mode=None):
        self.w,self.h=w,h; self.force_mode=force_mode; self._t=0
        self._modes={"rd":RDMode(w//2,h//2),"voronoi":VoronoiMode(w//2,h//2),
                     "fractal":FractalMode(w//2,h//2),"nebula":NebulaMode(w//2,h//2),
                     "dream":NeuralDreamMode(w//2,h//2)}
        self._cur_mode="rd"; self._last_switch=0
        self._vign=vignette(w,h,.52)
        self._vign_sm=vignette(w//2,h//2,.52)
        self._cache_hue=-1; self._cache_cm=None

    def _get_mode(self,audio):
        if self.force_mode: return self.force_mode
        scene=audio.get("scene")
        if scene and scene in SCENE_MODE: return SCENE_MODE[scene]
        # Auto-rotate every 45s
        if self._t-self._last_switch>45*25:
            idx=(self.MODE_NAMES.index(self._cur_mode)+1)%len(self.MODE_NAMES)
            self._cur_mode=self.MODE_NAMES[idx]; self._last_switch=self._t
        return self._cur_mode

    def generate(self,audio)->Image.Image:
        self._t+=1
        mood=audio.get("mood","neutral"); scene=audio.get("scene")
        mH=MOOD_HUE.get(mood,200); sH=SCENE_HUE.get(scene or "",None)
        centroid=float(audio.get("centroid",.3))
        hue=float(((sH if sH else mH)+centroid*50-25)%360+360)%360
        mode=self._get_mode(audio); self._cur_mode=mode
        # Run at half res, upscale
        try:
            rgb=self._modes[mode].render(audio,hue,self._vign_sm)
            img_half=Image.fromarray((np.clip(rgb,0,1)*255).astype(np.uint8),"RGB")
        except (MemoryError, Exception) as e:
            # Memory allocation failed or render error — return a minimal fallback frame.
            # This keeps the server alive instead of crashing on low-RAM machines.
            log.warning(f"[ProceduralOrchestrator] render failed ({e.__class__.__name__}): {e} — using fallback frame")
            # Tiny solid-colour frame based on mood hue, upscaled
            try:
                import colorsys
                r,g,b=colorsys.hsv_to_rgb(hue/360,0.6,0.25)
                tiny=Image.new("RGB",(32,32),(int(r*255),int(g*255),int(b*255)))
                return tiny.resize((self.w,self.h),Image.NEAREST)
            except Exception:
                return Image.new("RGB",(self.w,self.h),(10,10,20))
        img=img_half.resize((self.w,self.h),Image.LANCZOS)
        try:
            arr=np.array(img,np.float32)/255
            # Global contrast + saturation
            energy=float(audio.get("energy",.5)); beat=float(audio.get("beat",0))
            arr=np.clip(arr*(.85+energy*.3),0,1)
            out=Image.fromarray((arr*255).astype(np.uint8),"RGB")
            out=ImageEnhance.Color(out).enhance(1.25+energy*.45+beat*.15)
            out=ImageEnhance.Contrast(out).enhance(1.08+energy*.18)
            return out
        except (MemoryError, Exception) as e:
            log.warning(f"[ProceduralOrchestrator] post-process failed: {e} — returning unprocessed frame")
            return img_half.resize((self.w,self.h),Image.NEAREST)

# ══════════════════════════════════════════════════════════
# ML TIERS (Tier 1–3) — unchanged from v1
# ══════════════════════════════════════════════════════════
class StyleGANONNX:
    Z_DIM=512
    def __init__(self):
        import os
        self.MODEL_PATH=Path(os.path.dirname(os.path.abspath(__file__)))/"models"/"stylegan2_abstract.onnx"
        self.sess=None; rng=np.random.default_rng(99)
        self.z=rng.standard_normal((1,self.Z_DIM)).astype(np.float32)
        self.bass_dir=rng.standard_normal(self.Z_DIM).astype(np.float32)
        self.mid_dir=rng.standard_normal(self.Z_DIM).astype(np.float32)
        self.hi_dir=rng.standard_normal(self.Z_DIM).astype(np.float32)
        self.energy_dir=rng.standard_normal(self.Z_DIM).astype(np.float32)
        self._rng=rng

    def load(self)->bool:
        if not ONNX_OK: return False
        if not self.MODEL_PATH.exists():
            log.warning(f"StyleGAN model missing: {self.MODEL_PATH}"); return False
        try:
            self.sess=ort.InferenceSession(str(self.MODEL_PATH),
                providers=["CUDAExecutionProvider","CPUExecutionProvider"])
            log.info("StyleGAN2 ONNX ✓"); return True
        except Exception as e: log.error(f"StyleGAN load: {e}"); return False

    def generate(self,audio)->Image.Image|None:
        if not self.sess: return None
        bass=float(audio.get("bass",.3)); mid=float(audio.get("mid",.3))
        hi=float(audio.get("hi",.2)); energy=float(audio.get("energy",.5))
        beat=float(audio.get("beat",0))
        self.z[0]+=.008*(self.bass_dir*bass*.9+self.mid_dir*mid*.7+
                         self.hi_dir*hi*.5+self.energy_dir*energy*.4)
        if beat>.8: self.z[0]+=self._rng.standard_normal(self.Z_DIM).astype(np.float32)*.12
        nm=np.sqrt((self.z[0]**2).sum())
        if nm>28: self.z[0]*=28/nm
        try:
            out=self.sess.run(None,{self.sess.get_inputs()[0].name:self.z})[0]
            img=np.clip((out[0].transpose(1,2,0)+1)/2,0,1)
            return Image.fromarray((img*255).astype(np.uint8),"RGB")
        except Exception as e: log.error(f"StyleGAN inference: {e}"); return None


class StableDiffusionGenerator:
    MODELS=[("stabilityai/sdxl-turbo","sdxl_turbo",1,.55),
            ("SimianLuo/LCM_Dreamshaper_v7","lcm_dreamshaper",4,.50)]
    def __init__(self):
        self.pipe=None; self.model_id=None; self.num_steps=1; self.strength=.55
        self.prev_image=None
        self.device="cuda" if (TORCH_OK and torch.cuda.is_available()) else "cpu"
        self.dtype=(torch.float16 if self.device=="cuda" else torch.float32) if TORCH_OK else None

    def load(self)->bool:
        if not DIFFUSERS_OK or not TORCH_OK: return False
        for model_id,name,steps,strength in self.MODELS:
            try:
                log.info(f"Loading {name}...")
                pipe=AutoPipelineForImage2Image.from_pretrained(
                    model_id,torch_dtype=self.dtype if self.dtype else None,
                    variant="fp16" if self.device=="cuda" else None)
                if "lcm" in name.lower(): pipe.scheduler=LCMScheduler.from_config(pipe.scheduler.config)
                pipe=pipe.to(self.device)
                try: pipe.enable_xformers_memory_efficient_attention()
                except: pass
                self.pipe=pipe; self.model_id=name; self.num_steps=steps; self.strength=strength
                log.info(f"✓ {name} on {self.device}"); return True
            except Exception as e: log.warning(f"{name}: {e}")
        return False

    def generate(self,audio)->Image.Image|None:
        if not self.pipe: return None
        if self.prev_image is None: self.prev_image=Image.new("RGB",(512,512),(20,20,40))
        prompt=build_prompt(audio.get("mood","neutral"),audio.get("scene"),
                            float(audio.get("energy",.5)),float(audio.get("bpm",120)))
        strength=min(.85,max(.25,self.strength+float(audio.get("beat",0))*.12))
        try:
            import contextlib
            ctx=(torch.autocast(self.device) if (TORCH_OK and self.device=="cuda") else contextlib.nullcontext())
            with ctx:
                r=self.pipe(prompt=prompt,negative_prompt=NEGATIVE,image=self.prev_image,
                            num_inference_steps=self.num_steps,strength=strength,
                            guidance_scale=0.0 if "turbo" in (self.model_id or "") else 1.5).images[0]
            self.prev_image=r; return r
        except Exception as e: log.error(f"SD error: {e}"); return None

# ══════════════════════════════════════════════════════════
# MAIN SERVER
# ══════════════════════════════════════════════════════════
class AIVisualServer:
    def __init__(self,port=5678,resolution=512,force_tier=None,force_mode=None):
        self.port=port; self.res=resolution; self.force_tier=force_tier
        self.tier=0; self.tier_name="initializing"
        self.sd=StableDiffusionGenerator(); self.gan=StyleGANONNX()
        self.proc=ProceduralOrchestrator(resolution,resolution,force_mode)
        self.audio={"mood":"neutral","energy":.5,"bpm":120,"bass":.3,"mid":.3,"hi":.2,"beat":0,"scene":None}
        self.latest_frame=None; self.frame_lock=threading.Lock()
        self.gen_q=queue.Queue(maxsize=1); self.clients=set()
        self.running=False; self.frames_sent=0

    def initialize(self):
        ft=self.force_tier
        if ft==4: self._at(4,"Reaction-Diffusion+Voronoi+Fractal+Nebula+Dream"); return
        if ft!=3 and (not ft or ft in(1,2)):
            if self.sd.load():
                t=1 if "turbo" in (self.sd.model_id or "") else 2
                self._at(t,self.sd.model_id or "stable_diffusion"); return
        if not ft or ft==3:
            if self.gan.load(): self._at(3,"StyleGAN2-ONNX"); return
        self._at(4,"5-Mode Procedural Generator")

    def _at(self,n,name): self.tier=n; self.tier_name=name; log.info(f"✅ Tier {n}: {name}")

    def _gen_loop(self):
        log.info(f"Generation loop — Tier {self.tier}: {self.tier_name}")
        target_gap=.033 if self.tier==4 else .10 if self.tier==3 else .25
        while self.running:
            try: audio=self.gen_q.get(timeout=target_gap)
            except queue.Empty: audio=self.audio.copy()
            t0=time.perf_counter()
            try:
                if   self.tier in(1,2): img=self.sd.generate(audio)   or self.proc.generate(audio)
                elif self.tier==3:      img=self.gan.generate(audio)   or self.proc.generate(audio)
                else:                   img=self.proc.generate(audio)
            except Exception as e: log.error(e); img=self.proc.generate(audio)
            ms=(time.perf_counter()-t0)*1000
            if img:
                if img.size!=(self.res,self.res): img=img.resize((self.res,self.res),Image.LANCZOS)
                buf=BytesIO(); img.save(buf,format="JPEG",quality=83); b64=base64.b64encode(buf.getvalue()).decode()
                self.frames_sent+=1
                with self.frame_lock:
                    self.latest_frame={"type":"frame","frame":b64,"tier":self.tier,"model":self.tier_name,
                                       "latency_ms":round(ms),"fps":round(1000/max(1,ms),1),
                                       "mode":self.proc._cur_mode if self.tier==4 else None,
                                       "frame_n":self.frames_sent}
            remaining=target_gap-(time.perf_counter()-t0)
            if remaining>0: time.sleep(remaining)

    async def handler(self,ws):
        self.clients.add(ws)
        log.info(f"+ client  total={len(self.clients)}")
        await ws.send(json.dumps({"type":"status","tier":self.tier,"model":self.tier_name,
                                   "resolution":self.res,"gpu":TORCH_OK and (torch.cuda.is_available() if TORCH_OK else False)}))
        async def push():
            sent_n=-1
            while True:
                with self.frame_lock: f=self.latest_frame
                if f and f.get("frame_n",-1)!=sent_n:
                    sent_n=f.get("frame_n",-1)
                    try: await ws.send(json.dumps(f))
                    except websockets.exceptions.ConnectionClosed: break
                await asyncio.sleep(.035)
        pt=asyncio.create_task(push())
        try:
            async for msg in ws:
                try:
                    d=json.loads(msg); self.audio=d
                    try: self.gen_q.put_nowait(d)
                    except queue.Full: pass
                except: pass
        except websockets.exceptions.ConnectionClosed: pass
        finally:
            pt.cancel(); self.clients.discard(ws)
            log.info(f"- client  total={len(self.clients)}")

    async def run(self):
        self.running=True
        threading.Thread(target=self._gen_loop,daemon=True).start()
        log.info(f"ws://127.0.0.1:{self.port}  Tier {self.tier}  {self.tier_name}")
        async with websockets.serve(self.handler,"127.0.0.1",self.port,max_size=10*1024*1024,ping_interval=20):
            await asyncio.Future()

# ══════════════════════════════════════════════════════════
def main():
    p=argparse.ArgumentParser(description="ARAEA AI Visual Server")
    p.add_argument("--port",type=int,default=5678)
    p.add_argument("--res", type=int,default=512,
                   help="Output resolution (default 512). Use 256 on low-RAM machines.")
    p.add_argument("--tier",type=int,default=None,choices=[1,2,3,4])
    p.add_argument("--mode",type=str,default=None,
                   choices=["rd","voronoi","fractal","nebula","dream"],
                   help="Force a specific Tier 4 visual mode")
    p.add_argument("--low-mem",action="store_true",
                   help="Use 256px internal resolution to reduce RAM usage (~4x less memory). "
                        "Recommended if you see 'Unable to allocate' numpy errors.")
    args=p.parse_args()
    print("""
╔══════════════════════════════════════════════════════╗
║   ARAEA  —  AI Generative Visual Server  v2          ║
╠══════════════════════════════════════════════════════╣
║  Tier 4 visual modes (CPU, always available):        ║
║   rd       Gray-Scott reaction diffusion             ║
║   voronoi  Crystal cell growth + plasma              ║
║   fractal  Mandelbrot boundary + plasma storm        ║
║   nebula   Particle force-field nebula               ║
║   dream    Neural feedback loop synthesis            ║
║  Use: python ai_visual_server.py --mode nebula       ║
╚══════════════════════════════════════════════════════╝
""")
    res = 256 if args.low_mem else args.res
    if args.low_mem:
        print("[ai_visual_server] --low-mem: using 256px resolution to conserve RAM")
    srv=AIVisualServer(port=args.port,resolution=res,force_tier=args.tier,force_mode=args.mode)
    srv.initialize()
    asyncio.run(srv.run())

if __name__=="__main__":
    main()