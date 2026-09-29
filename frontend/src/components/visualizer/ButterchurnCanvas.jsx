// ButterchurnCanvas.jsx — ARAEA Stage 3 
// Milkdrop WebGL visualizer
// FIX: AudioContext requires user gesture — initialize on first click
// FIX: Synthetic audio driven by liveRef BPM/energy for Spotify reactivity

import { useState, useEffect, useRef, useCallback } from "react";

const MOOD_KEYWORDS = {
  euphoric:[  "electric","burst","explosion","flash","neon","wild"],
  happy:   [  "bloom","bounce","joy","bright","sunny","spring"],
  calm:    [  "drift","float","gentle","wave","fluid","soft"],
  melancholic:["smoke","dark","deep","void","shadow","fade"],
  tense:   [  "storm","sharp","pulse","strike","impact","aggro"],
  sad:     [  "slow","melt","dissolve","blur","wash","grey"],
  neutral: [  ""],
  angry:   [  "storm","sharp","strike","aggro","impact","pulse"],
  energetic:[ "pump","energy","power","beat","burst","electric"],
  surprised:[ "flash","burst","bright","bounce","electric","wild"],
  fearful: [  "dark","void","shadow","smoke","deep","fade"],
};
const SCENE_KEYWORDS = {
  party:  ["burst","neon","rave","flash","dance","electric"],
  focus:  ["grid","geometry","clean","precise","matrix"],
  sleep:  ["drift","float","gentle","cloud","breath"],
  workout:["pulse","beat","pump","energy","power"],
  cosmic: ["space","star","nebula","galaxy","void","deep"],
  jazz:   ["smoke","vintage","warm","amber","lounge"],
  wakeup: ["bright","rise","dawn","warm","gold"],
  relax:  ["wave","fluid","gentle","soft","calm"],
};

function pickPreset(presets,mood,scene){
  const keys=Object.keys(presets);
  const kws=[...(scene&&SCENE_KEYWORDS[scene]||[]),...(MOOD_KEYWORDS[mood]||[])];
  if(kws.length&&kws[0]){
    const m=keys.filter(k=>kws.some(w=>k.toLowerCase().includes(w)));
    if(m.length) return m[Math.floor(Math.random()*m.length)];
  }
  return keys[Math.floor(Math.random()*keys.length)];
}

// Synthetic audio — MUST be called from a user gesture (click)
// Improved v2: wider freq range (200-1000Hz), tempo-synced modulation, beat punch
function createSyntheticAudio(liveRef){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    const analyser=ctx.createAnalyser();
    analyser.fftSize=2048;
    analyser.smoothingTimeConstant=0.82;
    osc.type="sawtooth";
    gain.gain.value=0.0003;
    osc.connect(gain);
    gain.connect(analyser);
    gain.connect(ctx.destination);
    osc.start();
    // Drive from liveRef every 16ms — reacts to Spotify BPM/beat/energy
    const iv=setInterval(()=>{
      const live=liveRef?.current||{};
      const energy=live.energy||0.3;
      const beat=live.beatFlash||0;
      const kick=live.kickFlash||0;
      const centroid=live.spectralCentroid||live.centroid||0.3;
      const bpm=live.bpm||0;
      // Improved gain: energy base + beat punch + kick thump
      const baseGain=0.0002+energy*0.001;
      const beatBoost=beat?0.002:0;
      const kickBoost=kick?0.003:0;
      gain.gain.setTargetAtTime(baseGain+beatBoost+kickBoost,ctx.currentTime,0.02);
      // Improved frequency: 200-1000Hz range (was 30-550Hz — too low for Butterchurn)
      let freq=200+centroid*800+energy*120;
      // Tempo-synced modulation adds rhythmic movement to the visualizer
      if(bpm>0){
        const phase=(Date.now()/(60000/bpm))%1;
        freq+=Math.sin(phase*Math.PI*2)*50;
      }
      osc.frequency.setTargetAtTime(Math.max(80,freq),ctx.currentTime,0.05);
    },16);
    return{ctx,analyser,cleanup:()=>{clearInterval(iv);try{osc.stop();}catch{}ctx.close();}};
  }catch(e){
    console.warn("[Butterchurn] synthetic audio:",e.message);
    return null;
  }
}

export default function ButterchurnCanvas({liveRef,audioEngine,mood="neutral",scene=null}){
  const canvasRef =useRef(null);
  const vizRef    =useRef(null);
  const presetsRef=useRef(null);
  const frameRef  =useRef(null);
  const synthRef  =useRef(null);
  const initializedRef=useRef(false);
  const lastMood=useRef(mood);
  const lastScene=useRef(scene);
  const [status,setStatus]=useState("click"); // "click"|"loading"|"ready"|"error"
  const [presetName,setPresetName]=useState("");
  const [presetList,setPresetList]=useState([]);
  const [showList,setShowList]=useState(false);
  const [noAudio,setNoAudio]=useState(false);

  // Preset change on mood/scene
  useEffect(()=>{
    if(!vizRef.current||!presetsRef.current) return;
    if(mood===lastMood.current&&scene===lastScene.current) return;
    lastMood.current=mood; lastScene.current=scene;
    const chosen=pickPreset(presetsRef.current,mood,scene);
    vizRef.current.loadPreset(presetsRef.current[chosen],2.0);
    setPresetName(chosen);
  },[mood,scene]);

  // Resize
  useEffect(()=>{
    if(!canvasRef.current) return;
    const ro=new ResizeObserver(()=>{
      const c=canvasRef.current; if(!c||!vizRef.current) return;
      const W=c.clientWidth||800,H=c.clientHeight||500;
      c.width=W; c.height=H;
      vizRef.current.setRendererSize(W,H);
    });
    ro.observe(canvasRef.current);
    return()=>ro.disconnect();
  },[]);

  // Cleanup on unmount
  useEffect(()=>{
    return()=>{
      cancelAnimationFrame(frameRef.current);
      synthRef.current?.cleanup();
      synthRef.current=null;
      initializedRef.current=false;
    };
  },[]);

  // Try to use real audio engine first (mic connected)
  useEffect(()=>{
    const audioCtx=audioEngine?.getAudioContext?.();
    const analyser=audioEngine?.getAnalyser?.();
    if(audioCtx&&analyser&&!initializedRef.current){
      initButterchurn(audioCtx,analyser,false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[audioEngine]);

  const initButterchurn=useCallback(async(audioCtx,analyser,isSynthetic)=>{
    if(initializedRef.current) return;
    initializedRef.current=true;
    setStatus("loading");
    try{
      const butterchurn=(await import("butterchurn")).default;
      const bPresets=(await import("butterchurn-presets")).default;
      const canvas=canvasRef.current;
      if(!canvas){ initializedRef.current=false; return; }
      const W=canvas.clientWidth||800,H=canvas.clientHeight||500;
      canvas.width=W; canvas.height=H;
      const viz=butterchurn.createVisualizer(audioCtx,canvas,{width:W,height:H});
      viz.connectAudio(analyser);
      vizRef.current=viz;
      const presets=bPresets.getPresets();
      presetsRef.current=presets;
      setPresetList(Object.keys(presets).sort());
      const chosen=pickPreset(presets,mood,scene);
      viz.loadPreset(presets[chosen],0);
      setPresetName(chosen);
      setNoAudio(isSynthetic);
      setStatus("ready");
      const render=()=>{ frameRef.current=requestAnimationFrame(render); viz.render(); };
      render();
    }catch(err){
      console.warn("[Butterchurn] init failed:",err.message);
      initializedRef.current=false;
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Click handler — creates AudioContext (required user gesture) then inits
  const handleStart=useCallback(async()=>{
    if(initializedRef.current||status==="loading") return;
    // Try real audio first
    const realCtx=audioEngine?.getAudioContext?.();
    const realAn =audioEngine?.getAnalyser?.();
    if(realCtx&&realAn){ initButterchurn(realCtx,realAn,false); return; }
    // Fallback: synthetic audio driven by liveRef
    const syn=createSyntheticAudio(liveRef);
    if(!syn){ setStatus("error"); return; }
    synthRef.current=syn;
    initButterchurn(syn.ctx,syn.analyser,true);
  },[audioEngine,liveRef,initButterchurn,status]);

  const nextPreset=useCallback(()=>{
    if(!vizRef.current||!presetsRef.current) return;
    const chosen=pickPreset(presetsRef.current,mood,scene);
    vizRef.current.loadPreset(presetsRef.current[chosen],1.5);
    setPresetName(chosen);
  },[mood,scene]);

  const randomPreset=useCallback(()=>{
    if(!vizRef.current||!presetsRef.current) return;
    const keys=Object.keys(presetsRef.current);
    const k=keys[Math.floor(Math.random()*keys.length)];
    vizRef.current.loadPreset(presetsRef.current[k],1.5);
    setPresetName(k);
  },[]);

  const loadPreset=useCallback((name)=>{
    if(!vizRef.current||!presetsRef.current?.[name]) return;
    vizRef.current.loadPreset(presetsRef.current[name],1.5);
    setPresetName(name); setShowList(false);
  },[]);

  return(
    <div style={{position:"absolute",inset:0,zIndex:2,overflow:"hidden",
                 background: status==="ready" ? "transparent" : "rgba(3,4,14,0.92)"}}
         onClick={status==="click"?handleStart:undefined}>
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block"}}/>

      {/* Click to start — Chrome requires user gesture for AudioContext */}
      {status==="click"&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(3,4,14,.85)",gap:14,cursor:"pointer"}}>
          <div style={{fontSize:36}}>🎛</div>
          <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,.85)"}}>Milkdrop Visualizer</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center",maxWidth:260,lineHeight:1.7}}>
            Click anywhere to start the Milkdrop engine.<br/>
            Enable mic for full audio reactivity, or it will<br/>sync to Spotify BPM automatically.
          </div>
          <div style={{padding:"10px 24px",borderRadius:8,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer"}}>
            ▶ Start Milkdrop
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,.2)",fontFamily:"monospace"}}>100 WebGL presets · GPU rendered</div>
        </div>
      )}

      {/* Loading */}
      {status==="loading"&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#030408",gap:12}}>
          <div style={{width:32,height:32,border:"2px solid rgba(255,255,255,.15)",borderTopColor:"rgba(255,255,255,.7)",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Loading Milkdrop engine…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Error */}
      {status==="error"&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#030408",gap:10}}>
          <div style={{fontSize:11,color:"rgba(255,100,100,.7)"}}>Failed to load Milkdrop</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>Run: cd frontend && npm install butterchurn butterchurn-presets</div>
          <button onClick={()=>{initializedRef.current=false;setStatus("click");}} style={{fontSize:10,padding:"4px 12px",borderRadius:6,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer"}}>Retry</button>
        </div>
      )}

      {/* Ready: controls + audio badge */}
      {status==="ready"&&(
        <>
          {noAudio&&(
            <div style={{position:"absolute",top:10,left:10,fontSize:9,color:"rgba(255,165,0,.75)",background:"rgba(0,0,0,.6)",borderRadius:5,padding:"3px 8px",fontFamily:"monospace",letterSpacing:.5,pointerEvents:"none"}}>
              🎙 SYNTHETIC — enable mic for full audio
            </div>
          )}
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 12px",background:"linear-gradient(transparent,rgba(0,0,0,.75))",display:"flex",alignItems:"center",gap:8,zIndex:10}}>
            <div style={{flex:1,minWidth:0,fontSize:9,color:"rgba(255,255,255,.35)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{presetName}</div>
            <button onClick={e=>{e.stopPropagation();nextPreset();}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.18)",background:"rgba(0,0,0,.5)",color:"rgba(255,255,255,.7)",fontSize:10,cursor:"pointer",flexShrink:0}}>Mood ✦</button>
            <button onClick={e=>{e.stopPropagation();randomPreset();}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.18)",background:"rgba(0,0,0,.5)",color:"rgba(255,255,255,.7)",fontSize:10,cursor:"pointer",flexShrink:0}}>Random ↺</button>
            <button onClick={e=>{e.stopPropagation();setShowList(v=>!v);}} style={{padding:"4px 10px",borderRadius:6,border:`1px solid rgba(255,255,255,${showList?.3:.12})`,background:showList?"rgba(255,255,255,.12)":"rgba(0,0,0,.5)",color:`rgba(255,255,255,${showList?.9:.6})`,fontSize:10,cursor:"pointer",flexShrink:0}}>All Presets</button>
          </div>
          {showList&&(
            <div style={{position:"absolute",bottom:40,right:0,width:280,maxHeight:320,background:"rgba(3,4,14,.95)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"10px 0 0 0",overflowY:"auto",padding:"8px 0"}}>
              <div style={{padding:"4px 12px 8px",fontSize:9,color:"rgba(255,255,255,.35)",fontFamily:"monospace",letterSpacing:1,borderBottom:"1px solid rgba(255,255,255,.08)",marginBottom:4}}>{presetList.length} PRESETS</div>
              {presetList.map(name=>(
                <button key={name} onClick={()=>loadPreset(name)} style={{display:"block",width:"100%",padding:"5px 12px",textAlign:"left",background:name===presetName?"rgba(255,255,255,.1)":"transparent",border:"none",color:name===presetName?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:10,cursor:"pointer",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {name===presetName?"▶ ":""}{name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
