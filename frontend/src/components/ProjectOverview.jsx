// ProjectOverview.jsx — ARAEA Stage 3 project info page
export default function ProjectOverview({ T }) {
  const S = {
    page:   { padding:14, overflowY:"auto", height:"100%", boxSizing:"border-box" },
    card:   { background:T.bg2, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", marginBottom:12, boxShadow:T.sh },
    h2:     { fontSize:13, fontWeight:700, color:T.bright, marginBottom:6 },
    label:  { fontSize:9, letterSpacing:2, color:T.muted, textTransform:"uppercase", fontWeight:600, fontFamily:"monospace", marginBottom:8 },
    text:   { fontSize:11, color:T.muted, lineHeight:1.75 },
    badge:  (col) => ({ fontSize:9, padding:"2px 8px", borderRadius:4, background:`${col}18`, color:col, border:`1px solid ${col}33`, fontWeight:700, fontFamily:"monospace", marginRight:5, display:"inline-block", marginBottom:4 }),
    row:    { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}` },
    dot:    (col) => ({ width:7, height:7, borderRadius:"50%", background:col, flexShrink:0, marginTop:3 }),
    mono:   { fontSize:10, fontFamily:"monospace", background:T.bg3, padding:"8px 12px", borderRadius:7, border:`1px solid ${T.border}`, lineHeight:1.9, color:T.text },
    grid2:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
    grid3:  { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 },
    stat:   { background:T.bg3, borderRadius:9, padding:"10px 12px", border:`1px solid ${T.border}` },
  };

  const FEATURES = [
    { col:"#3b82f6", icon:"🎵", title:"Real-time Audio Analysis",    desc:"Web Audio API FFT 2048-point, beat detection with variance-adaptive threshold, spectral centroid, chromagram (12 pitch classes), BPM estimation, sub-bass kick tracking." },
    { col:"#8b5cf6", icon:"🎨", title:"Synesthesia-Quality Visuals",  desc:"8 scene renderers with additive compositing (lighter), logarithmic frequency mapping, 256-bar radial spectrum, multi-pass bloom glow, beat shockwaves, particle physics." },
    { col:"#a855f7", icon:"🧬", title:"AI Generative Visuals",        desc:"5-mode procedural generator: Reaction-Diffusion, Voronoi Plasma, Fractal Storm, Particle Nebula, Neural Dream. Upgrades to SDXL-Turbo/StyleGAN with GPU." },
    { col:"#10b981", icon:"❤",  title:"Biometric Integration",        desc:"Heart rate, HRV, stress score, skin conductance, coherence. Simulated by default, connects to Polar H10, Grove GSR, or any BLE device via POST /api/biometric." },
    { col:"#f59e0b", icon:"🌿", title:"Guided Therapy Engine",        desc:"4 programs: 4-7-8 breathing, stress relief, deep focus, sleep prep. Animated breath guide, live biofeedback, session history, clinical application ready." },
    { col:"#ef4444", icon:"🎙", title:"Voice & Gesture Control",      desc:"Web Speech API (Chrome): 12 voice commands for scenes, lights, therapy. Camera-based gesture simulation with keyboard shortcuts and confidence scoring." },
    { col:"#f97316", icon:"💡", title:"Multi-Sensory IoT Control",    desc:"LED strip (WLED), Philips Hue, aroma diffuser with 8 scents, smart fan, AC/thermostat, blinds, speaker EQ — all auto-adjusted by mood+stress." },
    { col:"#0ea5e9", icon:"📡", title:"ESP32 Sensor Integration",     desc:"DHT22 (temp/humidity), BH1750 (light), PIR (motion) → POST /api/sensors. Context engine maps sensor data to time-aware ambient presets." },
    { col:"#6366f1", icon:"🌐", title:"Community Hub",               desc:"Browse and apply 8+ curated ambient profiles. Share your current environment state — scene, lighting, IoT config, biometrics — with a name and tags." },
    { col:"#14b8a6", icon:"🧠", title:"AI Insights Engine",          desc:"Mood distribution analysis, therapy effectiveness tracking, 24h stress patterns, fusion model status showing all 5 input signals." },
  ];

  const APIS = [
    ["POST","/api/sensors",      "ESP32: temperature, humidity, light, motion"],
    ["POST","/api/biometric",    "Heart rate, HRV, stress, coherence from hardware"],
    ["POST","/api/emotion/manual","Override detected emotion"],
    ["POST","/api/scene",        "Activate scene preset"],
    ["POST","/api/therapy/start","Start therapy session {mode}"],
    ["POST","/api/therapy/stop", "End current session"],
    ["POST","/api/voice",        "Process voice command transcript"],
    ["POST","/api/gesture",      "Trigger gesture action"],
    ["POST","/api/multisensory/:device","Control LED/Hue/fan/diffuser etc"],
    ["GET", "/api/community/profiles","Browse community ambient profiles"],
    ["POST","/api/community/share",   "Share current environment"],
    ["GET", "/api/insights",    "AI pattern analysis + recommendations"],
    ["GET", "/api/state",        "Full system snapshot"],
    ["GET", "/health",           "Backend status + Stage 3 features"],
  ];

  const STACK = [
    { layer:"Frontend",  items:["React 18 + Vite","Socket.IO Client","Web Audio API","Web Speech API","Canvas 2D (additive)"] },
    { layer:"Backend",   items:["Node.js + Express","Socket.IO","MongoDB (optional)","Spotify OAuth 2.0","Context Engine"] },
    { layer:"AI Server", items:["Python 3.11+","websockets","Pillow + NumPy","Reaction-Diffusion","Fractal + Voronoi"] },
    { layer:"ML (opt.)", items:["PyTorch + CUDA","diffusers (HuggingFace)","SDXL-Turbo / LCM","StyleGAN2 ONNX","onnxruntime-gpu"] },
    { layer:"Hardware",  items:["ESP32 + DHT22","BH1750 light sensor","PIR motion sensor","Philips Hue Bridge","WLED LED strip"] },
  ];

  return (
    <div style={S.page}>

      {/* Hero */}
      <div style={{...S.card, background:`linear-gradient(135deg,${T.accBg},${T.bg2})`, border:`1px solid ${T.acc}22`, marginBottom:12}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <div style={{width:48,height:48,borderRadius:12,background:T.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,boxShadow:`0 4px 16px ${T.acc}44`}}>🎵</div>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:T.bright,lineHeight:1.1,marginBottom:4}}>ARAEA — AIoT Music Ambient System</div>
            <div style={{fontSize:11,color:T.muted,lineHeight:1.6,maxWidth:640}}>
              Adaptive Responsive Ambient Environment Automation. An intelligent Stage 3 system that synchronises lighting, IoT devices, and generative AI visuals with real-time music analysis — combining Artificial Intelligence and Internet of Things for immersive, emotion-aware environments.
            </div>
            <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Stage 3 Pro","Real-time FFT","AI Generative","IoT Control","Biometric","Voice/Gesture","Therapy","Community"].map(t=>(
                <span key={t} style={S.badge(T.acc)}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{...S.grid3, marginBottom:12}}>
        {[{n:"11",u:"Dashboard Tabs"},{n:"8",u:"Visual Scenes"},{n:"5",u:"AI Visual Modes"},
          {n:"14",u:"API Endpoints"},{n:"4",u:"Therapy Programs"},{n:"12",u:"Voice Commands"}].map(s=>(
          <div key={s.u} style={S.stat}>
            <div style={{fontSize:22,fontWeight:800,color:T.acc,fontFamily:"monospace",lineHeight:1}}>{s.n}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:3}}>{s.u}</div>
          </div>
        ))}
      </div>

      {/* Features grid */}
      <div style={{...S.label,marginBottom:10}}>Core Features</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {FEATURES.map(f=>(
          <div key={f.title} style={{...S.card,marginBottom:0,display:"flex",gap:10,alignItems:"flex-start",padding:"12px 14px"}}>
            <div style={{width:34,height:34,borderRadius:8,background:`${f.col}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,border:`1px solid ${f.col}22`}}>{f.icon}</div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.bright,marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:10,color:T.muted,lineHeight:1.65}}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.label}>Quick Start — 3 Terminals</div>
        <div style={S.mono}>
          <div style={{marginBottom:6}}>
            <span style={{color:T.muted}}># Terminal 1 — Backend</span><br/>
            <span style={{color:"#10b981"}}>cd</span> <span style={{color:T.acc}}>araea-stage3/backend</span>
            {" && "}<span style={{color:"#10b981"}}>npm install</span>
            {" && "}<span style={{color:"#10b981"}}>node server.js</span>
          </div>
          <div style={{marginBottom:6}}>
            <span style={{color:T.muted}}># Terminal 2 — Frontend</span><br/>
            <span style={{color:"#10b981"}}>cd</span> <span style={{color:T.acc}}>araea-stage3/frontend</span>
            {" && "}<span style={{color:"#10b981"}}>npm install</span>
            {" && "}<span style={{color:"#10b981"}}>npm run dev</span>
          </div>
          <div>
            <span style={{color:T.muted}}># Terminal 3 — AI Visuals (CPU, always works)</span><br/>
            <span style={{color:"#10b981"}}>cd</span> <span style={{color:T.acc}}>araea-stage3/python</span>
            {" && "}<span style={{color:"#10b981"}}>pip install websockets Pillow numpy scipy</span>
            {" && "}<span style={{color:"#10b981"}}>python ai_visual_server.py --tier 4</span>
          </div>
        </div>
        <div style={{marginTop:10,fontSize:10,color:T.muted}}>
          Then open <span style={{color:T.acc,fontFamily:"monospace"}}>http://localhost:5173</span> in Chrome.
          Click <span style={{color:"#a855f7",fontWeight:700}}>AI VISUALS</span> button in header to enable generative frames.
        </div>
      </div>

      {/* Tech stack */}
      <div style={{...S.label,marginBottom:10}}>Technology Stack</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
        {STACK.map(layer=>(
          <div key={layer.layer} style={S.stat}>
            <div style={{fontSize:10,fontWeight:700,color:T.acc,marginBottom:6}}>{layer.layer}</div>
            {layer.items.map(i=><div key={i} style={{fontSize:9,color:T.muted,lineHeight:1.8}}>· {i}</div>)}
          </div>
        ))}
      </div>

      {/* API reference */}
      <div style={S.card}>
        <div style={S.label}>Full API Reference</div>
        <div style={S.mono}>
          {APIS.map(([m,p,d])=>(
            <div key={p} style={{display:"grid",gridTemplateColumns:"38px 230px 1fr",gap:10,borderBottom:`1px solid ${T.border}`,padding:"2px 0"}}>
              <span style={{color:m==="GET"?"#10b981":"#f59e0b",fontWeight:700}}>{m}</span>
              <span style={{color:T.acc}}>{p}</span>
              <span style={{color:T.muted,fontSize:9}}>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
