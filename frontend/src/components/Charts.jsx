// Charts.jsx — Reusable SVG chart components, no library needed
// Supports light + dark mode via T theme object

export function LineChart({ data=[], color="#3b82f6", height=60, fill=true, T }){
  if(!data.length) return <div style={{height}}/>;
  const mn=Math.min(...data), mx=Math.max(...data), rng=mx-mn||1;
  const W=100, H=height;
  const pts=data.map((v,i)=>[
    (i/(data.length-1||1))*W,
    H-((v-mn)/rng)*(H-8)-4
  ]);
  const pStr=pts.map(([x,y])=>`${x},${y}`).join(" ");
  const aStr=fill?`${pStr} ${W},${H} 0,${H}`:null;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
      {fill&&<polygon points={aStr} fill={`${color}25`}/>}
      <polyline points={pStr} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Last point dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color}/>
    </svg>
  );
}

export function BarChart({ data=[], color="#3b82f6", height=80, T, labels=[] }){
  if(!data.length) return <div style={{height}}/>;
  const mx=Math.max(...data)||1;
  const barW=100/data.length;
  const gap=0.15;
  return(
    <svg viewBox={`0 0 100 ${height}`} style={{width:"100%",height}} preserveAspectRatio="none">
      {data.map((v,i)=>{
        const bh=(v/mx)*(height-4);
        const x=i*barW+barW*gap;
        const w=barW*(1-gap*2);
        return(
          <g key={i}>
            <rect x={x} y={height-bh} width={w} height={bh} rx="1.5"
              fill={color} opacity={0.85-(i/data.length)*0.1}/>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ segments=[], size=80, stroke=10, T }){
  // segments: [{value, color, label}]
  const total=segments.reduce((s,x)=>s+x.value,0)||1;
  const R=(size-stroke)/2, circ=2*Math.PI*R;
  let offset=0;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} fill="none"
        stroke={T?.bg4||"#e2e8f0"} strokeWidth={stroke}/>
      {segments.map((s,i)=>{
        const len=(s.value/total)*circ;
        const dash=`${len} ${circ}`;
        const rot=offset/total*360-90;
        offset+=s.value;
        return(
          <circle key={i} cx={size/2} cy={size/2} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke-1}
            strokeDasharray={dash} strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${rot} ${size/2} ${size/2})`}
            style={{transition:"stroke-dasharray .5s ease"}}/>
        );
      })}
    </svg>
  );
}

export function AreaBands({ rows=[], colors=[], height=60, T }){
  // rows: array of value arrays (stacked areas)
  if(!rows.length||!rows[0]?.length) return <div style={{height}}/>;
  const n=rows[0].length;
  const mx=Math.max(...rows.flat())||1;
  const W=100, H=height;
  const pts=(row)=>row.map((v,i)=>[i/(n-1||1)*W, H-(v/mx)*(H-4)-2]);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
      {rows.map((row,ri)=>{
        const p=pts(row);
        const pStr=p.map(([x,y])=>`${x},${y}`).join(" ");
        return(
          <g key={ri}>
            <polygon points={`${pStr} ${W},${H} 0,${H}`} fill={`${colors[ri]||"#3b82f6"}30`}/>
            <polyline points={pStr} fill="none" stroke={colors[ri]||"#3b82f6"} strokeWidth="1.5"/>
          </g>
        );
      })}
    </svg>
  );
}

export function HeatRow({ values=[], color="#3b82f6", label="", T }){
  const mx=Math.max(...values)||1;
  return(
    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
      {label&&<span style={{fontSize:9,color:T?.muted||"#64748b",width:22,textAlign:"right",flexShrink:0,fontFamily:"monospace"}}>{label}</span>}
      {values.map((v,i)=>(
        <div key={i} title={`${v}`} style={{
          flex:1, height:12, borderRadius:2,
          background:`${color}${Math.round(15+(v/mx)*200).toString(16).padStart(2,"0")}`,
          transition:"background .3s"
        }}/>
      ))}
    </div>
  );
}

export function StatCard({ icon, value, label, sub, color="#3b82f6", T }){
  return(
    <div style={{background:T?.bg3||"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${T?.border||"rgba(0,0,0,.08)"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:9,color:T?.muted||"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{label}</div>
          <div style={{fontSize:20,fontWeight:800,color,fontFamily:"monospace",lineHeight:1}}>{value}</div>
          {sub&&<div style={{fontSize:9,color:T?.muted||"#64748b",marginTop:3}}>{sub}</div>}
        </div>
        {icon&&<span style={{fontSize:20,opacity:.7}}>{icon}</span>}
      </div>
    </div>
  );
}
