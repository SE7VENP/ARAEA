// AIVisualCanvas.jsx — ARAEA Stage 3
// Connects to Python AI visual server (ws://127.0.0.1:5678)
// Streams AI-generated frames over the audio-reactive canvas
import { useEffect, useRef, useState, useCallback } from "react";

const AI_WS_URL = "ws://127.0.0.1:5678"; // Fixed: matches Python server port
const SEND_INTERVAL_MS = 400; // 2.5 fps audio state → server

const TIER_LABELS = {
  1: { name:"SDXL-Turbo",    color:"#a855f7", badge:"GPU · 1-step diffusion" },
  2: { name:"SD+LCM",        color:"#6366f1", badge:"GPU · 4-step diffusion" },
  3: { name:"StyleGAN ONNX", color:"#3b82f6", badge:"CPU · latent walk"       },
  4: { name:"RD+Fourier",    color:"#10b981", badge:"CPU · procedural"        },
};

export default function AIVisualCanvas({ liveRef, enabled, blendMode="screen", opacity=0.62, showHUD=true }){
  const canvasRef   = useRef(null);
  const wsRef       = useRef(null);
  const imgARef     = useRef(null); // current displayed image
  const imgBRef     = useRef(null); // next incoming image
  const alphaRef    = useRef(1);    // cross-fade alpha (0→1)
  const rafRef      = useRef(null);
  const sendTimerRef= useRef(null);

  const [status,    setStatus]    = useState("disconnected"); // disconnected|connecting|connected|error
  const [modelInfo, setModelInfo] = useState(null);
  const [latency,   setLatency]   = useState(null);
  const [frameCount,setFrameCount]= useState(0);
  const [prompt,    setPrompt]    = useState(null);

  // ── Decode base64 → HTMLImageElement ──────────────────
  const decodeFrame = useCallback((b64) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/jpeg;base64,${b64}`;
    });
  }, []);

  // ── Canvas render loop ─────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current; if(!c) return;
    const ctx = c.getContext("2d");
    let running = true;

    const resize = () => {
      const parent = c.parentElement; if(!parent) return;
      c.width  = parent.clientWidth;
      c.height = parent.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if(c.parentElement) ro.observe(c.parentElement);

    function draw(){
      if(!running) return;
      rafRef.current = requestAnimationFrame(draw);
      const W = c.width, H = c.height; if(!W||!H) return;
      ctx.clearRect(0,0,W,H);
      if(!enabled) return;

      // Cross-fade imgA → imgB
      if(imgBRef.current && alphaRef.current < 1){
        alphaRef.current = Math.min(1, alphaRef.current + 0.04);
        if(alphaRef.current >= 1){
          imgARef.current = imgBRef.current;
          imgBRef.current = null;
          alphaRef.current = 1;
        }
      }

      const drawImg = (img, alpha) => {
        if(!img) return;
        ctx.globalAlpha = alpha;
        // Fit image to canvas, maintain aspect
        const iw = img.naturalWidth, ih = img.naturalHeight;
        if(!iw || !ih) return;
        const scale = Math.max(W/iw, H/ih);
        const dw = iw*scale, dh = ih*scale;
        const dx = (W-dw)/2, dy = (H-dh)/2;
        ctx.drawImage(img, dx, dy, dw, dh);
      };

      if(imgARef.current && imgBRef.current){
        drawImg(imgARef.current, 1 - alphaRef.current);
        drawImg(imgBRef.current, alphaRef.current);
      } else if(imgARef.current){
        drawImg(imgARef.current, 1);
      }
      ctx.globalAlpha = 1;
    }
    draw();
    return () => { running=false; cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [enabled]);

  // ── Send audio state to Python server ─────────────────
  const sendAudioState = useCallback(() => {
    if(!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const live = liveRef.current;
    const fd   = live.freqData;
    const msg  = {
      mood:     live.mood      || "neutral",
      energy:   live.energy    || 0.5,
      bpm:      live.bpm       || 120,
      scene:    live.scene     || null,
      bass:     live.bass      || 0.3,
      mid:      live.mid       || 0.3,
      hi:       live.hi        || 0.2,
      beat:     live.beatFlash || 0,
      centroid: live.centroid  || 0.3,
      chroma:   live.chroma    ? Array.from(live.chroma) : null,
      fft_data: fd             ? Array.from(fd).slice(0,64).map(v=>v/255) : null,
    };
    try { wsRef.current.send(JSON.stringify(msg)); } catch {}
  }, [liveRef]);

  // ── WebSocket lifecycle ────────────────────────────────
  useEffect(() => {
    if(!enabled){
      wsRef.current?.close();
      wsRef.current = null;
      setStatus("disconnected");
      clearInterval(sendTimerRef.current);
      return;
    }

    let reconnectTimer = null;
    let destroyed = false;
    let failCount = 0;
    const MAX_RETRIES = 3; // stop spamming console after 3 failed attempts

    function connect(){
      if(destroyed) return;
      if(failCount >= MAX_RETRIES) {
        setStatus("error");
        return;
      }
      setStatus("connecting");
      const ws = new WebSocket(AI_WS_URL);

      ws.onopen = () => {
        failCount = 0;
        setStatus("connected");
        sendTimerRef.current = setInterval(sendAudioState, SEND_INTERVAL_MS);
      };

      ws.onclose = () => {
        setStatus("disconnected");
        clearInterval(sendTimerRef.current);
        if(!destroyed && failCount < MAX_RETRIES)
          reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        failCount += 1;
        // Suppress console error spam — server simply isn't running
        setStatus(failCount >= MAX_RETRIES ? "error" : "disconnected");
      };

      ws.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data);
          if(data.type === "status"){
            setModelInfo(data);
          } else if(data.type === "frame" && data.frame){
            const img = await decodeFrame(data.frame);
            if(img){
              imgBRef.current = img;
              alphaRef.current = 0;
              setLatency(data.latency_ms);
              setFrameCount(n => n+1);
              if(data.prompt) setPrompt(data.prompt);
            }
          }
        } catch {}
      };

      wsRef.current = ws;
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      clearInterval(sendTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, sendAudioState, decodeFrame]);

  // ── Status color ──────────────────────────────────────
  const statusColor = {
    connected:    "#10b981",
    connecting:   "#f59e0b",
    disconnected: "#94a3b8",
    error:        "#ef4444",
  }[status] || "#94a3b8";

  const tierInfo = modelInfo ? TIER_LABELS[modelInfo.tier] : null;

  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:5 }}>
      {/* AI frame canvas — only draws when enabled */}
      <canvas
        ref={canvasRef}
        style={{
          position:"absolute", inset:0,
          width:"100%", height:"100%",
          mixBlendMode: blendMode,
          opacity: enabled ? opacity : 0,
          transition: "opacity .6s ease",
          pointerEvents:"none",
          display: enabled ? "block" : "none",
        }}
      />

      {/* HUD overlay — only shown when enabled */}
      {showHUD && enabled && (
        <div style={{
          position:"absolute", bottom:36, right:10,
          background:"rgba(255,255,255,.9)",
          backdropFilter:"blur(8px)",
          borderRadius:8, padding:"6px 10px",
          border:"1px solid rgba(15,23,42,.1)",
          boxShadow:"0 2px 8px rgba(0,0,0,.06)",
          pointerEvents:"auto",
          minWidth:160,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:statusColor,boxShadow:`0 0 5px ${statusColor}`,flexShrink:0}}/>
            <span style={{fontSize:9,fontWeight:700,color:"#0f172a",fontFamily:"monospace",letterSpacing:.5}}>
              AI VISUALS
            </span>
            <span style={{fontSize:9,color:statusColor,fontFamily:"monospace",marginLeft:"auto"}}>{status.toUpperCase()}</span>
          </div>

          {modelInfo && (
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
              <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:tierInfo?.color+"22",color:tierInfo?.color,fontFamily:"monospace",fontWeight:700}}>
                T{modelInfo.tier}
              </span>
              <span style={{fontSize:9,color:"#1e293b",fontWeight:600}}>{tierInfo?.name}</span>
              {modelInfo.gpu && <span style={{fontSize:8,padding:"1px 4px",background:"#fef3c7",color:"#d97706",borderRadius:3,fontWeight:700}}>GPU</span>}
            </div>
          )}

          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {latency != null && (
              <span style={{fontSize:9,color:"#64748b",fontFamily:"monospace"}}>{latency}ms</span>
            )}
            <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace"}}>{frameCount} frames</span>
          </div>

          {tierInfo && (
            <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>{tierInfo.badge}</div>
          )}
          {modelInfo?.tier===4 && latency && (
            <div style={{fontSize:8,color:"#a855f7",marginTop:2,fontFamily:"monospace",fontWeight:700}}>
              MODE: {(modelInfo?.mode||"rd").toUpperCase()}
            </div>
          )}

          {status==="disconnected" && (
            <div style={{fontSize:8,color:"#ef4444",marginTop:3,lineHeight:1.5}}>
              Start python server:<br/>
              <code style={{fontSize:8,background:"#f1f5f9",padding:"1px 4px",borderRadius:3,color:"#3b82f6"}}>
                python ai_visual_server.py
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
