import { useEffect, useRef, useState } from "react";
import { health } from "../services/backendAPI.js";

// Particle + wave background canvas
function ParticleCanvas() {
  const cvsRef = useRef(null);
  useEffect(() => {
    const c = cvsRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const pts = Array.from({ length: 90 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: .5 + Math.random() * 1.8,
      hue: 140 + Math.random() * 80,
      a: .12 + Math.random() * .45,
    }));
    let t = 0, raf;
    const frame = () => {
      raf = requestAnimationFrame(frame); t += .004;
      ctx.fillStyle = "rgba(3,4,14,.07)"; ctx.fillRect(0, 0, c.width, c.height);
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        for (let x = 0; x <= c.width; x += 4) {
          const y = c.height * .5 + Math.sin(x * .006 + t * (1 + w * .3) + w * 1.8) * c.height * (.06 + w * .03);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${155 + w * 15},80%,55%,${.04 + w * .02})`;
        ctx.lineWidth = 1 + w; ctx.stroke();
      }
      pts.forEach(p => {
        p.x += p.vx + Math.sin(t + p.y * .009) * .08;
        p.y += p.vy + Math.cos(t + p.x * .009) * .08;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,62%,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 90) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `hsla(155,80%,55%,${(1 - d / 90) * .06})`; ctx.lineWidth = .5; ctx.stroke();
        }
      }
    };
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={cvsRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

// Floating music notes that drift upward
function FloatingNotes() {
  const notes = ["♪", "♫", "♩", "♬", "♭", "♮"];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} style={{
          position: "absolute",
          left: `${8 + (i * 8) % 88}%`,
          bottom: "-10%",
          fontSize: `${12 + (i % 4) * 6}px`,
          color: `hsla(${145 + i * 15},70%,60%,0)`,
          animation: `floatNote ${6 + (i % 5) * 2}s ease-in ${i * 0.8}s infinite`,
          userSelect: "none",
        }}>
          {notes[i % notes.length]}
        </span>
      ))}
    </div>
  );
}

// Animated equalizer bars
function EqBars() {
  const heights = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.5, 0.6];
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28, marginBottom: 28 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: `hsla(${145 + i * 8},75%,55%,0.7)`,
          animation: `eqBar ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.06}s infinite alternate`,
          height: `${h * 100}%`,
        }} />
      ))}
    </div>
  );
}

export default function LoginPage({ onLogin, authStatus }) {
  const [backendOk, setBackendOk] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const tryPing = (retries = 2) =>
      health.ping()
        .then(r => {
          if (r.data !== null || r.error === null) { setBackendOk(true); return; }
          if (retries > 0) setTimeout(() => tryPing(retries - 1), 2000);
          else setBackendOk(false);
        })
        .catch(() => {
          if (retries > 0) setTimeout(() => tryPing(retries - 1), 2000);
          else setBackendOk(false);
        });
    tryPing(2);
  }, []);

  const handleConnect = async () => {
    if (!backendOk) { alert("Backend server not running.\n\nRun: cd backend && npm run dev\n(or use start.bat)"); return; }
    setChecking(true);
    onLogin();
    setTimeout(() => setChecking(false), 3000);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#030408" }}>
      <ParticleCanvas />
      <FloatingNotes />

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(29,185,84,.07) 0%, transparent 70%)",
      }}>

        {/* Logo with breathing glow ring */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          {/* Outer breathing ring */}
          <div style={{
            position: "absolute", inset: -14,
            borderRadius: 28,
            border: "1.5px solid rgba(29,185,84,.25)",
            animation: "breatheRing 3s ease-in-out infinite",
          }} />
          {/* Middle ring */}
          <div style={{
            position: "absolute", inset: -7,
            borderRadius: 22,
            border: "1px solid rgba(29,185,84,.15)",
            animation: "breatheRing 3s ease-in-out .5s infinite",
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: "linear-gradient(135deg,#1DB954,#1ed760,#0d9e47)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(29,185,84,.5), 0 0 80px rgba(29,185,84,.2)",
            animation: "logoPulse 3s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>ARAEA</span>
          </div>
        </div>

        {/* Title with fade-in */}
        <h1 style={{
          fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: "#fff",
          margin: "0 0 8px", letterSpacing: "-1px", textAlign: "center",
          textShadow: "0 0 40px rgba(29,185,84,.4)",
          animation: "fadeUp .8s ease both",
        }}>ARAEA</h1>

        <p style={{
          fontSize: "clamp(11px,1.8vw,13px)", color: "rgba(255,255,255,.4)",
          margin: "0 0 20px", letterSpacing: 3, textTransform: "uppercase",
          textAlign: "center", fontFamily: "monospace",
          animation: "fadeUp .8s ease .15s both",
        }}>Adaptive Real-time Audio Emotion Ambient System</p>

        {/* Equalizer bars */}
        <div style={{ animation: "fadeUp .8s ease .25s both" }}>
          <EqBars />
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={checking || authStatus === "checking"}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 32px", borderRadius: 50,
            background: checking || authStatus === "checking" ? "#1a3326" : "#1DB954",
            border: "none", cursor: checking ? "wait" : "pointer",
            fontSize: 15, fontWeight: 800, color: "#fff",
            boxShadow: checking ? "none" : "0 4px 24px rgba(29,185,84,.5), 0 2px 8px rgba(0,0,0,.3)",
            transition: "all .2s", transform: "scale(1)",
            marginBottom: 28, minWidth: 260, justifyContent: "center",
            animation: "fadeUp .8s ease .35s both",
          }}
          onMouseEnter={e => !checking && (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          {!checking ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          ) : (
            <div style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          )}
          {checking || authStatus === "checking" ? "Connecting…" : "Connect with Spotify"}
        </button>

        {/* Status row */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center", animation: "fadeUp .8s ease .45s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: backendOk ? "#1DB954" : backendOk === false ? "#ef4444" : "#f59e0b", boxShadow: backendOk ? "0 0 6px #1DB954" : "none" }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.3)", fontFamily: "monospace", letterSpacing: .5 }}>
              {backendOk ? "BACKEND ONLINE" : backendOk === false ? "BACKEND OFFLINE — run start.bat" : "CHECKING…"}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.15)", fontFamily: "monospace" }}>·</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.3)", fontFamily: "monospace", letterSpacing: .5 }}>
            Spotify Premium recommended
          </span>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }

          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          @keyframes logoPulse {
            0%,100% { box-shadow: 0 0 40px rgba(29,185,84,.5), 0 0 80px rgba(29,185,84,.2); }
            50%      { box-shadow: 0 0 60px rgba(29,185,84,.8), 0 0 120px rgba(29,185,84,.35); }
          }

          @keyframes breatheRing {
            0%,100% { transform: scale(1);    opacity: .6; }
            50%      { transform: scale(1.18); opacity: 0; }
          }

          @keyframes floatNote {
            0%   { transform: translateY(0)    rotate(0deg);   opacity: 0; }
            10%  { opacity: .55; }
            90%  { opacity: .2; }
            100% { transform: translateY(-110vh) rotate(25deg); opacity: 0; }
          }

          @keyframes eqBar {
            from { transform: scaleY(.25); opacity: .5; }
            to   { transform: scaleY(1);   opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
