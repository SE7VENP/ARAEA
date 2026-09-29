// CommunityHub.jsx — community profile discovery and sharing
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme }  from "../theme.jsx";
import { community as communityAPI } from "../services/backendAPI.js";
import { lsGetJSON, lsSetJSON }      from "../utils/storage.js";

const TAG_COLORS = {
  lofi:"#8B5CF6",night:"#4338CA",focus:"#3B82F6",morning:"#F97316",
  energy:"#F59E0B",nature:"#10B981",calm:"#06B6D4",therapy:"#A855F7",
  rave:"#EF4444",bass:"#DC2626",sleep:"#4338CA",delta:"#6366F1",
  jazz:"#D97706",vintage:"#B45309",warm:"#92400E",gym:"#DC2626",
  hype:"#EF4444",power:"#B91C1C",study:"#2563EB",deep:"#1D4ED8",
};

export default function CommunityHub({ T: _T, currentState, onToast }) {
  const { T }   = useTheme();
  const [profiles,  setProfiles]  = useState([]);
  const [sort,      setSort]      = useState("likes");
  const [search,    setSearch]    = useState("");
  const [showShare, setShowShare] = useState(false);
  const [shareForm, setShareForm] = useState({ name: "", description: "", tags: "" });
  const [applied,   setApplied]   = useState(null);
  const [liked,     setLiked]     = useState(() => new Set(lsGetJSON("araea_liked", [])));
  const [loading,   setLoading]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState(null);
  const searchTimer = useRef(null);

  const fetchProfiles = useCallback(async (s = sort, q = search) => {
    setLoading(true); setFetchErr(null);
    const params = { sort: s, ...(q ? { search: q } : {}) };
    const { data, error } = await communityAPI.getProfiles(params);
    if (error) setFetchErr("Could not load profiles — backend may be offline");
    else       setProfiles(data?.profiles ?? []);
    setLoading(false);
  }, [sort, search]);

  useEffect(() => { fetchProfiles(); }, []); // eslint-disable-line

  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchProfiles(sort, val), 500);
  }, [sort, fetchProfiles]);

  const handleSortChange = useCallback((val) => {
    setSort(val);
    fetchProfiles(val, search);
  }, [search, fetchProfiles]);

  const applyProfile = useCallback(async (profile) => {
    const { data, error } = await communityAPI.apply(profile.id);
    if (error) { onToast?.("Could not apply profile"); return; }
    if (data?.ok) {
      setApplied(profile.id);
      onToast?.(`✓ Applied "${profile.name}"`);
      setTimeout(() => setApplied(null), 3000);
    }
  }, [onToast]);

  const shareProfile = useCallback(async () => {
    if (!shareForm.name.trim()) { onToast?.("⚠️ Please enter a profile name"); return; }
    const tags = shareForm.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const { data, error } = await communityAPI.share({ ...shareForm, tags });
    if (error) { onToast?.("Could not share — backend offline"); return; }
    if (data?.ok) {
      onToast?.(`🚀 "${shareForm.name}" shared`);
      setShowShare(false);
      setShareForm({ name: "", description: "", tags: "" });
      fetchProfiles();
    }
  }, [shareForm, onToast, fetchProfiles]);

  const likeProfile = useCallback(async (profile) => {
    const newLiked = new Set(liked);
    const alreadyLiked = newLiked.has(profile.id);
    alreadyLiked ? newLiked.delete(profile.id) : newLiked.add(profile.id);
    setLiked(newLiked);
    lsSetJSON("araea_liked", [...newLiked]);
    await communityAPI.like(profile.id, alreadyLiked ? -1 : 1);
    setProfiles(ps => ps.map(p =>
      p.id === profile.id ? { ...p, likes: Math.max(0, (p.likes ?? 0) + (alreadyLiked ? -1 : 1)) } : p
    ));
    if (!alreadyLiked) onToast?.(`♥ Liked "${profile.name}"`);
  }, [liked, onToast]);

  return (
    <div style={{ padding:9, overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      {/* Controls */}
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        <input value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Search profiles…"
          style={{ flex:1, padding:"7px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg2, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit" }} />
        <select value={sort} onChange={e => handleSortChange(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg2, color:T.text, fontSize:11, outline:"none", cursor:"pointer" }}>
          <option value="likes">Top Liked</option>
          <option value="downloads">Most Used</option>
          <option value="newest">Newest</option>
        </select>
        <button onClick={() => setShowShare(!showShare)}
          style={{ padding:"7px 12px", borderRadius:7, border:"1px solid #10B981", background:showShare?"rgba(16,185,129,.15)":"rgba(16,185,129,.08)", color:"#10B981", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
          {showShare ? "✕ Cancel" : "+ Share Mine"}
        </button>
      </div>

      {/* Share form */}
      {showShare && (
        <div style={{ background:T.bg2, border:"1px solid #10B98133", borderRadius:10, padding:12, marginBottom:10 }}>
          <div style={{ fontSize:9, color:"#10B981", letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:8 }}>Share Current Environment</div>
          {["name","description","tags"].map(field => (
            field === "description"
              ? <textarea key={field} value={shareForm[field]} onChange={e => setShareForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder="Describe this ambient experience…" rows={2}
                  style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg3, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", resize:"none", boxSizing:"border-box", marginBottom:8 }} />
              : <input key={field} value={shareForm[field]} onChange={e => setShareForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === "name" ? "Profile name…" : "Tags: focus, night, lofi…"}
                  style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg3, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginBottom:8 }} />
          ))}
          <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:10, padding:"6px 8px", background:T.bg3, borderRadius:7 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:currentState?.lighting?.hex ?? "#64748B", flexShrink:0 }} />
            <span style={{ fontSize:10, color:T.muted }}>Current: {currentState?.mood ?? "neutral"} · {currentState?.activeScene ?? "no scene"}</span>
          </div>
          <button onClick={shareProfile}
            style={{ width:"100%", padding:"8px", borderRadius:7, border:"1px solid #10B981", background:"rgba(16,185,129,.15)", color:"#10B981", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Share to Community →
          </button>
        </div>
      )}

      {fetchErr && !loading && (
        <div style={{ textAlign:"center", padding:"12px 0", color:T.danger, fontSize:11, marginBottom:8 }}>
          {fetchErr}
          <button onClick={() => fetchProfiles()} style={{ marginLeft:8, fontSize:10, color:T.acc, background:"none", border:`1px solid ${T.acc}44`, borderRadius:5, padding:"2px 8px", cursor:"pointer" }}>Retry</button>
        </div>
      )}

      {/* Profile grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {loading && profiles.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:20, color:T.muted, fontSize:11 }}>Loading profiles…</div>}
        {!loading && !fetchErr && profiles.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:20, color:T.muted, fontSize:11 }}>No profiles found</div>}
        {profiles.map(p => {
          const isApplied = applied === p.id;
          const isLiked   = liked.has(p.id);
          return (
            <div key={p.id} style={{ background:T.bg2, border:`1px solid ${isApplied ? p.color+"66" : T.border}`, borderRadius:10, padding:11, transition:"all .2s" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:`${p.color}20`, border:`1px solid ${p.color}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <div style={{ width:14, height:14, borderRadius:3, background:p.color }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                  <div style={{ fontSize:9, color:T.muted }}>@{p.author}</div>
                </div>
              </div>
              {p.description && <div style={{ fontSize:10, color:T.muted, lineHeight:1.5, marginBottom:7 }}>{p.description}</div>}
              {(p.tags?.length ?? 0) > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:7 }}>
                  {p.tags.slice(0, 4).map(tag => (
                    <span key={tag} style={{ fontSize:8, padding:"2px 6px", borderRadius:3, background:`${TAG_COLORS[tag] ?? "#64748B"}20`, color:TAG_COLORS[tag] ?? T.muted, border:`1px solid ${TAG_COLORS[tag] ?? "#64748B"}33` }}>{tag}</span>
                  ))}
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <button onClick={e => { e.stopPropagation(); likeProfile(p); }}
                    style={{ display:"flex", alignItems:"center", gap:3, padding:"3px 7px", borderRadius:5, border:`1px solid ${isLiked ? "#EF444444" : T.border}`, background:isLiked?"rgba(239,68,68,.1)":"transparent", color:isLiked?"#EF4444":T.muted, fontSize:9, cursor:"pointer", fontWeight:isLiked?700:400 }}>
                    {isLiked ? "♥" : "♡"} {p.likes ?? 0}
                  </button>
                  <span style={{ fontSize:9, color:T.dim }}>↓ {p.downloads ?? 0}</span>
                </div>
                <button onClick={() => applyProfile(p)}
                  style={{ padding:"4px 10px", borderRadius:5, border:`1px solid ${isApplied?p.color:T.border}`, background:isApplied?`${p.color}18`:"transparent", color:isApplied?p.color:T.muted, fontSize:9, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
                  {isApplied ? "✓ Applied" : "Apply"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
