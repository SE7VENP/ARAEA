// Icons.jsx — Professional SVG icon set for ARAEA
// Clean stroke-based icons, 24x24 viewBox, 1.5px stroke

const BASE = { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"1.5", strokeLinecap:"round", strokeLinejoin:"round" };

export function IconDashboard({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>;
}
export function IconVisualizer({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <line x1="2" y1="12" x2="2" y2="12" strokeWidth="2.5"/>
    <line x1="5.5" y1="8" x2="5.5" y2="16"/>
    <line x1="9" y1="5" x2="9" y2="19"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="15" y1="6" x2="15" y2="18"/>
    <line x1="18.5" y1="9" x2="18.5" y2="15"/>
    <line x1="22" y1="12" x2="22" y2="12" strokeWidth="2.5"/>
  </svg>;
}
export function IconBiometrics({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M12 21C12 21 3.5 15.5 3.5 9.5a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2C20.5 15.5 12 21 12 21z"/>
    <polyline points="1 12 5 12 7 8 9 16 11 12 13 12 15 9 17 14 19 12 23 12"/>
  </svg>;
}
export function IconTherapy({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M12 22V12"/>
    <path d="M12 12C12 12 7 9.5 7 5.5a5 5 0 0 1 5-5 5 5 0 0 1 5 5C17 9.5 12 12 12 12z"/>
    <path d="M12 12C12 12 8 14 6 17.5c-.8 1.4-.8 3 0 4.5"/>
    <path d="M12 12C12 12 16 14 18 17.5c.8 1.4.8 3 0 4.5"/>
  </svg>;
}
export function IconMicrophone({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <rect x="9" y="2" width="6" height="11" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <line x1="9" y1="21" x2="15" y2="21"/>
  </svg>;
}
export function IconMultiSensory({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M9 18h6M10 22h4"/>
    <path d="M5.7 4.7A8 8 0 1 0 18.3 17.3"/>
    <path d="M8.3 7.3A5 5 0 1 0 15.7 14.7"/>
    <circle cx="12" cy="11" r="2"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/>
    <line x1="2" y1="12" x2="4" y2="12"/>
  </svg>;
}
export function IconCommunity({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <circle cx="9" cy="7" r="3"/>
    <circle cx="17" cy="7" r="3"/>
    <path d="M2 21v-1a7 7 0 0 1 7-7h2"/>
    <path d="M16 21v-1a5 5 0 0 0-3-4.6"/>
    <path d="M22 21v-1a5 5 0 0 0-5-5h-1"/>
  </svg>;
}
export function IconInsights({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    <circle cx="12" cy="12" r="9" strokeDasharray="2 3"/>
  </svg>;
}
export function IconSensors({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
    <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <circle cx="12" cy="20" r="1" fill="currentColor"/>
  </svg>;
}
export function IconHistory({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 15"/>
    <path d="M3.05 9A9.1 9.1 0 0 1 7 4.06"/>
    <path d="M3 9H7V5"/>
  </svg>;
}
export function IconSettings({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>;
}
export function IconCamera({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M23 7l-7 5 7 5V7z"/>
    <rect x="1" y="5" width="15" height="14" rx="2"/>
    <circle cx="8.5" cy="12" r="2.5"/>
  </svg>;
}
export function IconGesture({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>
    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/>
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/>
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>;
}
export function IconWifi({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <line x1="1" y1="6" x2="23" y2="6"/>
    <path d="M5 12h.01M12 12h.01M19 12h.01"/>
    <path d="M12 17h.01"/>
  </svg>;
}
export function IconStop({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>;
}
export function IconActivity({ size=20, color="currentColor", style={} }){
  return <svg {...BASE} width={size} height={size} style={style} stroke={color}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>;
}
