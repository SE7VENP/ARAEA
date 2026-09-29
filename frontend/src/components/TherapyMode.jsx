// TherapyMode.jsx — ARAEA Stage 3
// Three tabs: Therapy Programs | Activity Applications | Presentation Hub
import { useState, useEffect, useRef } from "react";
import { therapy as therapyAPI, insights as insightsAPI } from "../services/backendAPI.js";

const PROG_COLORS = { breathwork:"#06B6D4", stress_relief:"#8B5CF6", focus_session:"#3B82F6", sleep_prep:"#4338CA" };
const PROG_ICONS  = { breathwork:"🌬", stress_relief:"🌿", focus_session:"🎯", sleep_prep:"🌙" };
const BREATH_PHASES = new Set(["inhale","hold","exhale"]);

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function BreathCircle({ phase, progress=0, color="#06B6D4" }) {
  const size=120, cx=size/2, cy=size/2, maxR=46, minR=14;
  const isBreath=BREATH_PHASES.has(phase);
  const r=!isBreath?maxR*.55:
           phase==="inhale"?minR+(maxR-minR)*Math.max(0,Math.min(1,progress)):
           phase==="hold"  ?maxR:
           maxR-(maxR-minR)*Math.max(0,Math.min(1,progress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{filter:`drop-shadow(0 0 ${r*.25}px ${color}88)`}}>
      <circle cx={cx} cy={cy} r={maxR+5} fill="none" stroke={color} strokeWidth="0.5" opacity="0.15"/>
      {[2.6,1.85,1].map((m,i)=>(
        <circle key={i} cx={cx} cy={cy} r={r*m*.42} fill={color} opacity={[.06,.11,.22][i]} style={{transition:"r .5s ease"}}/>
      ))}
      <circle cx={cx} cy={cy} r={Math.max(4,r-3)} fill={color} opacity="0.42" style={{transition:"r .5s ease"}}/>
      <text x={cx} y={cy+5} textAnchor="middle" fontSize={isBreath?9:15} fontWeight="700" fill={color} fontFamily="monospace">
        {isBreath?phase?.toUpperCase():"●"}
      </text>
    </svg>
  );
}

function CircleProgress({ value=0, size=80, color="#06B6D4", label="" }) {
  const r=(size-8)/2, circ=2*Math.PI*r, offset=circ*(1-Math.max(0,Math.min(1,value)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3" opacity="0.14"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset .8s ease"}}/>
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize="9" fontWeight="700" fill={color} fontFamily="monospace">{label}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 1 — Therapy Programs
// ─────────────────────────────────────────────────────────
function TherapyTab({ T, therapy, bio, onToast }) {
  const [programs, setPrograms]=useState({});
  const [history,  setHistory] =useState([]);
  const [selected, setSelected]=useState(null);
  useEffect(()=>{
    therapyAPI.getPrograms().then(({data})=>{ if(data?.programs) setPrograms(data.programs); });
    therapyAPI.getHistory().then(({data})=>{ if(data?.data) setHistory(data.data); });
  },[]);
  useEffect(()=>{
    if(!therapy?.active) setTimeout(()=>therapyAPI.getHistory().then(({data})=>{ if(data?.data) setHistory(data.data); }),800);
  },[therapy?.active]);

  const start=async(mode)=>{
    try{const {data:d,error}=await therapyAPI.start(mode);
      if(d?.ok){onToast?.(`${PROG_ICONS[mode]} ${d.program?.name} started`);setSelected(null);}
      else if(error) onToast?.("Backend not reachable")
    }catch{onToast?.("Backend not reachable");}
  };
  const stop=async()=>{
    try{ await therapyAPI.stop(); } catch{}
    onToast?.("Session ended");
  };

  const isActive=therapy?.active;
  const prog=isActive?programs[therapy.mode]:null;
  const isBreathing=therapy?.mode==="breathwork";
  const sMin=Math.floor((therapy?.sessionDuration||0)/60);
  const sSec=(therapy?.sessionDuration||0)%60;

  if(isActive&&prog) return (
    <div style={{padding:10,display:"flex",flexDirection:"column",gap:10}}>
      {/* Session header */}
      <div style={{background:T.bg2,border:`2px solid ${PROG_COLORS[therapy.mode]||"#06B6D4"}44`,borderRadius:12,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{fontSize:8,color:PROG_COLORS[therapy.mode],letterSpacing:2,textTransform:"uppercase",fontFamily:"monospace"}}>ACTIVE SESSION</div>
            <div style={{fontSize:16,fontWeight:800,color:T.bright,marginTop:3}}>{prog.name}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>{therapy.instruction}</div>
          </div>
          <button onClick={stop} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #EF4444",background:"rgba(239,68,68,.1)",color:"#EF4444",fontSize:10,fontWeight:700,cursor:"pointer"}}>STOP</button>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
          {isBreathing?(
            <div style={{textAlign:"center"}}>
              <BreathCircle phase={therapy.breathPhase} progress={therapy.breathProgress||0} color={PROG_COLORS[therapy.mode]}/>
              <div style={{fontSize:11,color:PROG_COLORS[therapy.mode],marginTop:4,fontWeight:700,textTransform:"capitalize"}}>{therapy.breathPhase}</div>
            </div>
          ):(
            <div style={{textAlign:"center"}}>
              <CircleProgress value={therapy.breathProgress||0} size={84} color={PROG_COLORS[therapy.mode]} label={`${Math.round((therapy.breathProgress||0)*100)}%`}/>
              <div style={{fontSize:12,fontWeight:700,color:PROG_COLORS[therapy.mode],marginTop:4,textTransform:"capitalize"}}>{therapy.phase}</div>
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
          {[{l:"Time",v:`${sMin}:${String(sSec).padStart(2,"0")}`},{l:"Phase",v:therapy.phase},{l:"Stress",v:`${Math.round(bio?.stressScore||30)}%`}].map(m=>(
            <div key={m.l} style={{textAlign:"center",background:T.bg3,borderRadius:8,padding:"8px 5px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:8,color:T.muted,marginBottom:1}}>{m.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:T.bright,fontFamily:"monospace"}}>{m.v}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:4}}>
          {prog.phases?.map((ph,i)=>{const pi=prog.phases.findIndex(p=>p.name===therapy.phase);const c=PROG_COLORS[therapy.mode];
            return <div key={ph.name} style={{flex:1,height:4,borderRadius:2,background:i<pi?c:i===pi?`${c}88`:T.bg4,transition:"background .5s"}}/>;
          })}
        </div>
      </div>
      {/* Biofeedback */}
      {bio&&<div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:12}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>LIVE BIOFEEDBACK</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {[{l:"HR",v:Math.round(bio.heartRate||72),u:"bpm",c:bio.heartRate>90?"#EF4444":"#10B981"},
            {l:"HRV",v:Math.round(bio.hrv||45),u:"ms",c:"#A78BFA"},
            {l:"Coherence",v:Math.round((bio.coherence||.68)*100),u:"%",c:"#06B6D4"},
            {l:"Stress",v:Math.round(bio.stressScore||30),u:"%",c:bio.stressScore>60?"#EF4444":"#10B981"}
          ].map(m=>(
            <div key={m.l} style={{textAlign:"center",background:T.bg3,borderRadius:7,padding:"7px 4px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:8,color:T.muted}}>{m.l}</div>
              <div style={{fontSize:14,fontWeight:800,color:m.c,fontFamily:"monospace"}}>{m.v}<span style={{fontSize:8,color:T.muted}}>{m.u}</span></div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );

  return (
    <div style={{padding:10,display:"flex",flexDirection:"column",gap:10}}>
      {/* Benefits panel */}
      <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:12}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>BENEFITS & RESEARCH</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{icon:"🧠",stat:"-40%",label:"Cortisol reduction",sub:"After 4-7-8 session"},
            {icon:"❤",stat:"+22%",label:"HRV improvement",sub:"After 2 weeks daily"},
            {icon:"😴",stat:"11min",label:"Faster sleep onset",sub:"Sleep prep protocol"},
            {icon:"🎯",stat:"1.8×",label:"Focus improvement",sub:"Before deep work"}
          ].map(b=>(
            <div key={b.label} style={{background:T.bg3,borderRadius:8,padding:"9px 10px",border:`1px solid ${T.border}`,textAlign:"center"}}>
              <div style={{fontSize:18,marginBottom:2}}>{b.icon}</div>
              <div style={{fontSize:16,fontWeight:800,color:T.acc,fontFamily:"monospace"}}>{b.stat}</div>
              <div style={{fontSize:10,fontWeight:600,color:T.text}}>{b.label}</div>
              <div style={{fontSize:8,color:T.muted,marginTop:1}}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Programs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {Object.entries(programs).map(([key,p])=>{
          const col=PROG_COLORS[key]||"#06B6D4";
          const isSel=selected===key;
          return(
            <div key={key} onClick={()=>setSelected(isSel?null:key)} style={{background:isSel?`${col}10`:T.bg2,border:`1px solid ${isSel?col+"66":T.border}`,borderRadius:10,padding:13,cursor:"pointer",transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
                <span style={{fontSize:20}}>{PROG_ICONS[key]||"🌿"}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.bright}}>{p.name}</div>
                  <div style={{fontSize:9,color:T.muted}}>{Math.round(p.duration/60)} min · target {p.targetStress}% stress</div>
                </div>
              </div>
              <div style={{fontSize:10,color:T.muted,lineHeight:1.55,marginBottom:isSel?8:0}}>{p.desc}</div>
              {isSel&&<button onClick={e=>{e.stopPropagation();start(key);}} style={{width:"100%",padding:"8px",borderRadius:7,border:`1px solid ${col}`,background:`${col}22`,color:col,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                Start Session →
              </button>}
            </div>
          );
        })}
      </div>

      {/* Session history */}
      {history.length>0&&<div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:12}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>RECENT SESSIONS</div>
        {history.slice(0,5).map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <span style={{fontSize:15}}>{PROG_ICONS[s.mode]||"🌿"}</span>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:T.text,textTransform:"capitalize"}}>{(s.mode||"").replace(/_/g," ")}</div>
                <div style={{fontSize:9,color:T.muted}}>{Math.round(s.duration/60)} min · {new Date(s.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#10B981",fontFamily:"monospace"}}>-{s.stressReduction}%</div>
              <div style={{fontSize:8,color:T.muted}}>stress</div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 2 — Activity Applications
// ─────────────────────────────────────────────────────────
function ActivitiesTab({ T, onToast }) {
  const [presets,setPresets]=useState({});
  const [active,setActive]=useState(null); // {id, preset, startedAt, phase, elapsed}
  const [selected,setSelected]=useState(null);
  const timerRef=useRef(null);

  useEffect(()=>{
    insightsAPI.getActivityPresets().then(({data})=>{ if(data?.presets) setPresets(data.presets); });
    return()=>clearInterval(timerRef.current);
  },[]);

  const startActivity=async(id)=>{
    const preset=presets[id]; if(!preset) return;
    await insightsAPI.startActivity(id).catch(()=>{});
    setActive({id,preset,startedAt:Date.now(),elapsed:0,phaseIdx:0});
    onToast?.(`${preset.icon} ${preset.name} started`);
    setSelected(null);
    timerRef.current=setInterval(()=>{
      setActive(a=>{
        if(!a) return a;
        const elapsed=Math.floor((Date.now()-a.startedAt)/1000);
        // Find phase
        let acc=0,phaseIdx=0;
        for(let i=0;i<a.preset.phases.length;i++){
          acc+=a.preset.phases[i].duration;
          if(elapsed<acc){phaseIdx=i;break;}
          if(i===a.preset.phases.length-1) phaseIdx=i;
        }
        if(elapsed>=a.preset.duration){clearInterval(timerRef.current);return null;}
        return{...a,elapsed,phaseIdx};
      });
    },1000);
  };

  const stopActivity=()=>{ clearInterval(timerRef.current); setActive(null); onToast?.("Activity ended"); };

  if(active){
    const {preset,elapsed,phaseIdx}=active;
    const phase=preset.phases[phaseIdx];
    const total=preset.duration;
    const progress=elapsed/total;
    // Phase elapsed
    let phaseStart=0;
    for(let i=0;i<phaseIdx;i++) phaseStart+=preset.phases[i].duration;
    const phaseProgress=(elapsed-phaseStart)/phase.duration;
    const remaining=total-elapsed;
    const rMin=Math.floor(remaining/60),rSec=remaining%60;
    return(
      <div style={{padding:10,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{background:T.bg2,border:`2px solid ${preset.color}44`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:8,color:preset.color,letterSpacing:2,textTransform:"uppercase",fontFamily:"monospace"}}>ACTIVITY ACTIVE</div>
              <div style={{fontSize:18,fontWeight:800,color:T.bright,marginTop:3}}>{preset.icon} {preset.name}</div>
            </div>
            <button onClick={stopActivity} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #EF4444",background:"rgba(239,68,68,.1)",color:"#EF4444",fontSize:10,fontWeight:700,cursor:"pointer"}}>END</button>
          </div>
          {/* Current phase */}
          <div style={{background:T.bg3,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1px solid ${preset.color}22`}}>
            <div style={{fontSize:10,color:preset.color,fontWeight:700,marginBottom:4,textTransform:"capitalize"}}>{phase.name.replace(/_/g," ")}</div>
            <div style={{fontSize:12,color:T.text,lineHeight:1.6}}>{phase.instruction}</div>
          </div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            <div style={{textAlign:"center",background:T.bg3,borderRadius:8,padding:"8px"}}>
              <div style={{fontSize:8,color:T.muted}}>ELAPSED</div>
              <div style={{fontSize:14,fontWeight:800,color:T.bright,fontFamily:"monospace"}}>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</div>
            </div>
            <div style={{textAlign:"center",background:T.bg3,borderRadius:8,padding:"8px"}}>
              <div style={{fontSize:8,color:T.muted}}>REMAINING</div>
              <div style={{fontSize:14,fontWeight:800,color:preset.color,fontFamily:"monospace"}}>{rMin}:{String(rSec).padStart(2,"0")}</div>
            </div>
            <div style={{textAlign:"center",background:T.bg3,borderRadius:8,padding:"8px"}}>
              <div style={{fontSize:8,color:T.muted}}>PROGRESS</div>
              <div style={{fontSize:14,fontWeight:800,color:"#10B981",fontFamily:"monospace"}}>{Math.round(progress*100)}%</div>
            </div>
          </div>
          {/* Overall progress */}
          <div style={{height:5,background:T.bg4,borderRadius:3,overflow:"hidden",marginBottom:6}}>
            <div style={{height:"100%",width:`${progress*100}%`,background:preset.color,borderRadius:3,transition:"width 1s linear"}}/>
          </div>
          {/* Phase markers */}
          <div style={{display:"flex",gap:3}}>
            {preset.phases.map((ph,i)=><div key={i} style={{flex:ph.duration/total,height:3,borderRadius:2,background:i<phaseIdx?preset.color:i===phaseIdx?`${preset.color}88`:T.bg4,transition:"background .5s"}}/>)}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:10,display:"flex",flexDirection:"column",gap:9}}>
      <div style={{fontSize:11,color:T.muted,lineHeight:1.7,padding:"8px 10px",background:T.bg2,borderRadius:8,border:`1px solid ${T.border}`}}>
        Activity applications combine <strong style={{color:T.text}}>music scene + lighting + timer</strong> automatically. One tap sets the perfect environment for any activity.
      </div>
      {Object.entries(presets).map(([id,p])=>{
        const isSel=selected===id;
        return(
          <div key={id} onClick={()=>setSelected(isSel?null:id)} style={{background:isSel?`${p.color}0e`:T.bg2,border:`1px solid ${isSel?p.color+"55":T.border}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <span style={{fontSize:24,flexShrink:0}}>{p.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.bright}}>{p.name}</div>
                  <div style={{fontSize:9,color:T.muted,fontFamily:"monospace",flexShrink:0,marginLeft:8}}>{Math.round(p.duration/60)} min</div>
                </div>
                <div style={{fontSize:10,color:T.muted,lineHeight:1.5,marginTop:2}}>{p.desc}</div>
              </div>
            </div>
            {/* Tags */}
            <div style={{display:"flex",gap:5,marginTop:9,flexWrap:"wrap"}}>
              {[{l:`🎵 ${p.scene}`,c:p.color},{l:`💡 auto-light`,c:"#10B981"},{l:`⏱ ${Math.round(p.duration/60)}min`,c:T.muted}].map(tag=>(
                <span key={tag.l} style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:`${tag.c}18`,color:tag.c,fontWeight:600,border:`1px solid ${tag.c}33`}}>{tag.l}</span>
              ))}
            </div>
            {isSel&&(
              <div style={{marginTop:11,display:"flex",gap:8,flexDirection:"column"}}>
                <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:80,overflowY:"auto"}}>
                  {p.phases.map((ph,i)=>(
                    <div key={i} style={{display:"flex",gap:7,fontSize:9,color:T.muted}}>
                      <span style={{color:p.color,fontFamily:"monospace",flexShrink:0,width:26}}>{Math.round(ph.duration/60)}m</span>
                      <span style={{textTransform:"capitalize"}}>{ph.name.replace(/_/g," ")} — {ph.instruction.substring(0,50)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={e=>{e.stopPropagation();startActivity(id);}} style={{padding:"9px",borderRadius:8,border:`1px solid ${p.color}`,background:`${p.color}22`,color:p.color,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {p.icon} Start {p.name} →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 3 — Presentation / Hall Hub
// ─────────────────────────────────────────────────────────
function PresentationTab({ T, onToast }) {
  const [moments,setMoments]=useState({});
  const [rooms,setRooms]=useState({});
  const [activeM,setActiveM]=useState(null);
  const [activeR,setActiveR]=useState(null);
  const [notes,setNotes]=useState("");

  useEffect(()=>{
    insightsAPI.getPresentationMoments().then(({data})=>{ if(data?.moments) setMoments(data.moments); });
    insightsAPI.getRoomPresets().then(({data})=>{ if(data?.presets) setRooms(data.presets); });
  },[]);

  const applyMoment=async(id)=>{
    setActiveM(id);
    await insightsAPI.applyMoment(id).catch(()=>{});
    onToast?.(`${moments[id]?.icon} ${moments[id]?.name}`);
  };

  const applyRoom=async(id)=>{
    setActiveR(id);
    await insightsAPI.applyRoom(id).catch(()=>{});
    onToast?.(`${rooms[id]?.icon} ${rooms[id]?.name} mode`);
  };

  return(
    <div style={{padding:10,display:"flex",flexDirection:"column",gap:12}}>

      {/* Presentation Moments */}
      <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:13}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:4}}>PRESENTATION HUB</div>
        <div style={{fontSize:10,color:T.muted,marginBottom:11,lineHeight:1.6}}>
          One-tap lighting + music for each moment in your presentation. Works with Philips Hue, WLED, or any connected smart light.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {Object.entries(moments).map(([id,m])=>{
            const isA=activeM===id;
            return(
              <button key={id} onClick={()=>applyMoment(id)} style={{padding:"12px 6px",borderRadius:10,border:`2px solid ${isA?m.color:T.border}`,background:isA?`${m.color}14`:T.bg3,cursor:"pointer",textAlign:"center",transition:"all .2s",boxShadow:isA?`0 2px 12px ${m.color}33`:undefined}}>
                <div style={{fontSize:22,marginBottom:4}}>{m.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:isA?m.color:T.text}}>{m.name}</div>
                <div style={{fontSize:8,color:T.muted,marginTop:2,lineHeight:1.3}}>{m.desc}</div>
                <div style={{marginTop:5,fontSize:8,color:m.color,padding:"1px 5px",borderRadius:6,background:`${m.color}18`,display:"inline-block"}}>
                  💡 {m.lighting?.brightness}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room Presets */}
      <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:13}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:4}}>ROOM ATMOSPHERE</div>
        <div style={{fontSize:10,color:T.muted,marginBottom:10,lineHeight:1.6}}>Set the perfect ambience for your space type.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
          {Object.entries(rooms).map(([id,r])=>{
            const isA=activeR===id;
            const col="#6366F1";
            return(
              <button key={id} onClick={()=>applyRoom(id)} style={{padding:"10px 5px",borderRadius:9,border:`1px solid ${isA?col:T.border}`,background:isA?`${col}14`:T.bg3,cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
                <div style={{fontSize:18,marginBottom:3}}>{r.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:isA?col:T.text}}>{r.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Presentation notes */}
      <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:13}}>
        <div style={{fontSize:8,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>SESSION NOTES</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes for this presentation / session..."
          style={{width:"100%",minHeight:80,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:11,color:T.text,resize:"vertical",outline:"none",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}/>
        <div style={{fontSize:8,color:T.dim,marginTop:5}}>Notes are saved in session only</div>
      </div>

      {/* Hardware tip */}
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px"}}>
        <div style={{fontSize:10,fontWeight:700,color:T.text,marginBottom:5}}>💡 Hardware Connection</div>
        <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:T.muted,lineHeight:1.7}}>
          <div>• <strong style={{color:T.text}}>Philips Hue:</strong> Settings → Multi-Sensory → enter Bridge IP + username</div>
          <div>• <strong style={{color:T.text}}>WLED strip:</strong> Settings → Multi-Sensory → enter WLED IP</div>
          <div>• <strong style={{color:T.text}}>No hardware?</strong> Lighting state still shows in Multi-Sensory panel for manual control</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────
export default function TherapyMode({ T, therapy, bio, onToast }) {
  const [tab,setTab]=useState("therapy");
  const tabs=[
    {id:"therapy",  label:"Therapy",        icon:"🌿"},
    {id:"activity", label:"Activities",     icon:"📚"},
    {id:"present",  label:"Presentation",   icon:"🎭"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.bg2}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 6px",border:"none",borderBottom:`2px solid ${tab===t.id?T.acc:"transparent"}`,background:"transparent",cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span style={{fontSize:13}}>{t.icon}</span>
            <span style={{fontSize:11,fontWeight:tab===t.id?700:500,color:tab===t.id?T.acc:T.muted}}>{t.label}</span>
            {t.id==="therapy"&&therapy?.active&&(
              <div style={{width:6,height:6,borderRadius:"50%",background:T.success,boxShadow:`0 0 4px ${T.success}`}}/>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflowY:"auto"}}>
        {tab==="therapy"  &&<TherapyTab   T={T} therapy={therapy} bio={bio} onToast={onToast}/>}
        {tab==="activity" &&<ActivitiesTab T={T} onToast={onToast}/>}
        {tab==="present"  &&<PresentationTab T={T} onToast={onToast}/>}
      </div>
    </div>
  );
}
