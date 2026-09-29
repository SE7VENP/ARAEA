// ThemeCustomizer.jsx — Full theme control with background vividity slider
import { useState, useEffect, useRef, useCallback } from "react";

const PRESETS=[
  {name:"Ocean",    hue:210,sat:75,mode:"light",bgDepth:55},
  {name:"Forest",   hue:145,sat:68,mode:"light",bgDepth:60},
  {name:"Sunset",   hue:22, sat:88,mode:"warm", bgDepth:65},
  {name:"Violet",   hue:265,sat:78,mode:"light",bgDepth:60},
  {name:"Rose",     hue:340,sat:80,mode:"warm", bgDepth:60},
  {name:"Teal",     hue:174,sat:74,mode:"light",bgDepth:55},
  {name:"Midnight", hue:235,sat:80,mode:"dark", bgDepth:70},
  {name:"Deep Dark",hue:270,sat:85,mode:"dark", bgDepth:80},
  {name:"Gold Dark",hue:42, sat:90,mode:"dark", bgDepth:75},
  {name:"Amber",    hue:38, sat:90,mode:"warm", bgDepth:70},
  {name:"Crimson",  hue:355,sat:82,mode:"dark", bgDepth:75},
  {name:"Slate",    hue:220,sat:18,mode:"light",bgDepth:30},
];
const MODES={
  light:{icon:"☀️",name:"Light",  desc:"Clean & bright"},
  warm: {icon:"🌅",name:"Warm",   desc:"Cosy & warm"},
  dark: {icon:"🌙",name:"Dark",   desc:"Full dark mode"},
};

// Compute bg colors matching buildT logic exactly
function previewColors(hue,sat,mode,bgDepth){
  const bd=bgDepth/100;
  const accL=mode==="dark"?62:50;
  const acc=`hsl(${hue},${sat}%,${accL}%)`;
  if(mode==="dark"){
    const ds=10+sat*0.28*bd;
    return{bg:`hsl(${hue},${(ds+2).toFixed(1)}%,9%)`,bg1:`hsl(${hue},${(ds+4).toFixed(1)}%,12%)`,bg2:`hsl(${hue},${ds.toFixed(1)}%,15%)`,acc};
  }
  if(mode==="warm"){
    const wh=(hue+16)%360, wv=Math.min(45,sat*0.45)*bd;
    return{bg:`hsl(${wh},${(wv+8).toFixed(1)}%,96%)`,bg1:`hsl(${wh},${(wv+14).toFixed(1)}%,93%)`,bg2:`hsl(${wh},${(wv*0.6).toFixed(1)}%,99%)`,acc};
  }
  const ps=sat*bd*0.54, cs=sat*bd*0.36;
  const pL=(96-ps*0.06).toFixed(1), cL=(99-cs*0.04).toFixed(1);
  return{bg:`hsl(${hue},${ps.toFixed(1)}%,${pL}%)`,bg1:`hsl(${hue},${(ps+5).toFixed(1)}%,${(parseFloat(pL)-3).toFixed(1)}%)`,bg2:`hsl(${hue},${cs.toFixed(1)}%,${cL}%)`,acc};
}

function ColorWheel({hue,sat,onHue,onSat,size=200}){
  const cvsRef=useRef(null),drag=useRef(null);
  useEffect(()=>{
    const c=cvsRef.current;if(!c)return;
    const ctx=c.getContext("2d"),cx=size/2,cy=size/2,r=size/2-6;
    ctx.clearRect(0,0,size,size);
    for(let i=0;i<360;i++){
      const a=(i-90)*Math.PI/180;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*(r-16),cy+Math.sin(a)*(r-16));ctx.lineTo(cx+Math.cos(a)*(r+1),cy+Math.sin(a)*(r+1));
      ctx.strokeStyle=`hsl(${i},90%,55%)`;ctx.lineWidth=2;ctx.stroke();
    }
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r-19);
    g.addColorStop(0,`hsl(${hue},0%,70%)`);g.addColorStop(1,`hsl(${hue},100%,52%)`);
    ctx.beginPath();ctx.arc(cx,cy,r-19,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    const ha=(hue-90)*Math.PI/180,hr=r-8;
    ctx.beginPath();ctx.arc(cx+Math.cos(ha)*hr,cy+Math.sin(ha)*hr,7,0,Math.PI*2);
    ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle=`hsl(${hue},90%,45%)`;ctx.lineWidth=2;ctx.stroke();
    const sr=(sat/100)*(r-21);
    ctx.beginPath();ctx.arc(cx+sr,cy,5,0,Math.PI*2);
    ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle=`hsl(${hue},${sat}%,40%)`;ctx.lineWidth=2;ctx.stroke();
  },[hue,sat,size]);
  const handle=useCallback((e)=>{
    const c=cvsRef.current;if(!c)return;
    const rect=c.getBoundingClientRect();
    const mx=(e.clientX||e.touches?.[0]?.clientX||0)-rect.left;
    const my=(e.clientY||e.touches?.[0]?.clientY||0)-rect.top;
    const cx=size/2,cy=size/2,r=size/2-6;
    const dx=mx-cx,dy=my-cy,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>r-18)onHue(Math.round(((Math.atan2(dy,dx)*180/Math.PI)+90+360)%360));
    else if(dist<r-19)onSat(Math.round(Math.min(100,Math.max(0,(dist/(r-21))*100))));
  },[size,onHue,onSat]);
  return(
    <canvas ref={cvsRef} width={size} height={size} style={{cursor:"crosshair",display:"block",margin:"0 auto"}}
      onMouseDown={e=>{drag.current=true;handle(e);}} onMouseMove={e=>{if(drag.current)handle(e);}}
      onMouseUp={()=>drag.current=false} onMouseLeave={()=>drag.current=false}/>
  );
}

function Preview({hue,sat,mode,bgDepth}){
  const C=previewColors(hue,sat,mode,bgDepth);
  const isDark=mode==="dark";
  const textC=isDark?"#e2e8f0":"#1e293b",mutedC=isDark?"#94a3b8":"#64748b";
  const border=isDark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)";
  return(
    <div style={{background:C.bg,borderRadius:10,padding:10,border:`1px solid ${border}`,transition:"all .3s"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 8px",background:C.bg2,borderRadius:7,border:`1px solid ${border}`}}>
        <div style={{width:20,height:20,borderRadius:5,background:C.acc,flexShrink:0,boxShadow:`0 2px 8px ${C.acc}55`}}/>
        <span style={{fontSize:10,fontWeight:800,color:textC}}>ARAEA</span>
        <div style={{flex:1}}/>
        <div style={{padding:"2px 8px",borderRadius:10,background:`${C.acc}25`,border:`1px solid ${C.acc}55`}}>
          <span style={{fontSize:8,color:C.acc,fontWeight:700}}>CALM</span>
        </div>
      </div>
      {/* Layout */}
      <div style={{display:"flex",gap:6}}>
        <div style={{width:22,background:C.bg1,borderRadius:5,padding:"4px 2px",display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{width:14,height:13,borderRadius:3,background:i===1?C.acc:`${C.acc}28`,border:`1px solid ${i===1?C.acc+"55":border}`}}/>
          ))}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
          <div style={{background:C.bg2,borderRadius:6,padding:"6px 8px",border:`1px solid ${border}`}}>
            <div style={{width:"55%",height:3,background:C.acc,borderRadius:2,marginBottom:4}}/>
            <div style={{width:"80%",height:2,background:mutedC,borderRadius:1,opacity:.4}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[0,1].map(i=><div key={i} style={{background:C.bg2,borderRadius:5,padding:"5px 6px",border:`1px solid ${border}`}}>
              <div style={{width:18,height:2,background:i===0?C.acc:mutedC,opacity:i===0?1:.35,borderRadius:1,marginBottom:3}}/>
              <div style={{width:"60%",height:2,background:mutedC,opacity:.3,borderRadius:1}}/>
            </div>)}
          </div>
          <div style={{height:4,borderRadius:2,background:`linear-gradient(90deg,${C.acc},${C.acc}55)`}}/>
        </div>
      </div>
    </div>
  );
}

export default function ThemeCustomizer({T,onThemeChange}){
  const saved=JSON.parse(localStorage.getItem("araea_theme_hsl")||"null");
  const [hue,     setHue]     = useState(saved?.hue     ?? 210);
  const [sat,     setSat]     = useState(saved?.sat     ?? 70);
  const [mode,    setMode]    = useState(saved?.mode    ?? "light");
  const [bgDepth, setBgDepth] = useState(saved?.bgDepth ?? 55);
  const [applied, setApplied] = useState(false);

  const C=previewColors(hue,sat,mode,bgDepth);

  const applyTheme=useCallback(()=>{
    localStorage.setItem("araea_theme_hsl",JSON.stringify({hue,sat,mode,bgDepth}));
    onThemeChange?.({hue,sat,mode,bgDepth});
    setApplied(true); setTimeout(()=>setApplied(false),2200);
  },[hue,sat,mode,bgDepth,onThemeChange]);

  // Live preview — debounced
  useEffect(()=>{
    const t=setTimeout(()=>onThemeChange?.({hue,sat,mode,bgDepth}),150);
    return()=>clearTimeout(t);
  },[hue,sat,mode,bgDepth,onThemeChange]);

  const card={background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10};
  const lbl={fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:8,fontFamily:"monospace",display:"block"};

  return(
    <div style={{padding:12,overflowY:"auto",height:"100%",boxSizing:"border-box"}}>

      {/* Mode */}
      <div style={card}>
        <span style={lbl}>Dashboard Mode</span>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {Object.entries(MODES).map(([m,info])=>{
            const a=mode===m;
            return(
              <button key={m} onClick={()=>setMode(m)}
                style={{padding:"11px 6px",borderRadius:9,border:`2px solid ${a?C.acc:T.border}`,background:a?`${C.acc}18`:T.bg3,cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
                <div style={{fontSize:22,marginBottom:4}}>{info.icon}</div>
                <div style={{fontSize:11,fontWeight:700,color:a?C.acc:T.text}}>{info.name}</div>
                <div style={{fontSize:9,color:T.muted,marginTop:2}}>{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div style={card}>
        <span style={lbl}>Live Preview</span>
        <Preview hue={hue} sat={sat} mode={mode} bgDepth={bgDepth}/>
      </div>

      {/* Color wheel */}
      <div style={card}>
        <span style={lbl}>Accent & Background Color</span>
        <ColorWheel hue={hue} sat={sat} onHue={setHue} onSat={setSat} size={200}/>
        {/* Hue + Sat sliders */}
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:10,color:T.muted,fontWeight:600}}>Hue</span>
              <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:C.acc}}>{hue}°</span>
            </div>
            <input type="range" min="0" max="360" step="1" value={hue}
              onChange={e=>setHue(Number(e.target.value))} style={{width:"100%",accentColor:C.acc}}/>
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:10,color:T.muted,fontWeight:600}}>Saturation</span>
              <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:C.acc}}>{sat}%</span>
            </div>
            <input type="range" min="10" max="100" step="1" value={sat}
              onChange={e=>setSat(Number(e.target.value))} style={{width:"100%",accentColor:C.acc}}/>
          </div>
        </div>
      </div>

      {/* Background depth — the key control */}
      <div style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div>
            <span style={lbl}>Background Vividity</span>
            <div style={{fontSize:10,color:T.muted,marginTop:-4}}>
              {bgDepth<20?"Neutral (white/dark only)"
               :bgDepth<50?"Subtle color tint"
               :bgDepth<75?"Clear color backgrounds"
               :"Vivid colored backgrounds"}
            </div>
          </div>
          <span style={{fontSize:13,fontWeight:800,color:C.acc,fontFamily:"monospace"}}>{bgDepth}%</span>
        </div>
        <input type="range" min="0" max="100" step="5" value={bgDepth}
          onChange={e=>setBgDepth(Number(e.target.value))} style={{width:"100%",accentColor:C.acc}}/>
        {/* Gradient preview of backgrounds */}
        <div style={{display:"flex",gap:5,marginTop:10,alignItems:"stretch",height:28}}>
          {[0,25,50,75,100].map(d=>{
            const c=previewColors(hue,sat,mode,d);
            return(
              <div key={d} onClick={()=>setBgDepth(d)}
                style={{flex:1,background:c.bg,borderRadius:5,cursor:"pointer",border:`2px solid ${d===bgDepth?C.acc:T.border}`,transition:"border .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:10,height:10,borderRadius:2,background:c.acc}}/>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:8,color:T.dim}}>
          <span>Neutral</span><span>Medium</span><span>Vivid</span>
        </div>
      </div>

      {/* Presets */}
      <div style={card}>
        <span style={lbl}>Quick Presets</span>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {PRESETS.map(p=>{
            const pc=previewColors(p.hue,p.sat,p.mode,p.bgDepth);
            const isA=Math.abs(hue-p.hue)<5&&Math.abs(sat-p.sat)<5&&mode===p.mode&&Math.abs(bgDepth-p.bgDepth)<10;
            return(
              <button key={p.name} onClick={()=>{setHue(p.hue);setSat(p.sat);setMode(p.mode);setBgDepth(p.bgDepth);}}
                style={{padding:"8px 4px",borderRadius:8,border:`2px solid ${isA?pc.acc:T.border}`,background:isA?`${pc.acc}18`:T.bg3,cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
                <div style={{width:28,height:20,borderRadius:4,background:pc.bg,margin:"0 auto 4px",border:`1px solid ${pc.acc}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:10,height:10,borderRadius:2,background:pc.acc}}/>
                </div>
                <div style={{fontSize:8,color:isA?pc.acc:T.muted,fontWeight:isA?700:500,lineHeight:1.2}}>{p.name}</div>
                <div style={{fontSize:7,color:T.dim,marginTop:1}}>{MODES[p.mode].icon}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Apply */}
      <div style={{display:"flex",gap:8}}>
        <button onClick={applyTheme}
          style={{flex:1,padding:"12px",borderRadius:9,border:"none",background:C.acc,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",boxShadow:`0 4px 16px ${C.acc}55`,transition:"all .2s",transform:applied?"scale(0.98)":"scale(1)"}}>
          {applied?"✓ Applied to whole dashboard!":"Apply Theme"}
        </button>
        <button onClick={()=>{setHue(210);setSat(70);setMode("light");setBgDepth(55);}}
          style={{padding:"12px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.bg2,color:T.muted,fontSize:11,fontWeight:600,cursor:"pointer"}}>
          Reset
        </button>
      </div>
      <div style={{fontSize:9,color:T.muted,textAlign:"center",marginTop:8,lineHeight:1.7}}>
        Changes apply to all backgrounds, cards, sidebar, borders and icons.
        Saved to browser — persists across sessions.
      </div>
    </div>
  );
}
