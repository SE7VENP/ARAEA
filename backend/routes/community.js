/** /api/community routes */
import { Router }   from "express";
import { clampNum } from "../middleware/validate.js";
import { COMMUNITY_PROFILES } from "../data/communityProfiles.js";
import { getState, emit }     from "../services/StateService.js";
import { getMemory }          from "../services/DatabaseService.js";
import { runPipeline }        from "../services/PipelineService.js";

const router = Router();

function allProfiles() {
  return [...COMMUNITY_PROFILES, ...getMemory().community];
}

router.get("/profiles", (req, res) => {
  const { sort = "likes", tag, search } = req.query;
  let list = allProfiles();
  if (tag)    list = list.filter(p => p.tags?.includes(String(tag).slice(0, 50)));
  if (search) {
    const q = String(search).toLowerCase().slice(0, 100);
    list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }
  if (sort === "likes")     list.sort((a, b) => b.likes - a.likes);
  else if (sort === "downloads") list.sort((a, b) => b.downloads - a.downloads);
  else if (sort === "newest")    list.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  res.json({ profiles: list, total: list.length });
});

router.post("/share", (req, res) => {
  const { name, description, tags } = req.body ?? {};
  const state   = getState();
  const profile = {
    id: `u${Date.now()}`, author: "you",
    name: String(name ?? "My Profile").slice(0, 80),
    scene: state.activeScene ?? "relax", mood: state.mood,
    tags: Array.isArray(tags) ? tags.map(t => String(t).slice(0, 30)).slice(0, 10) : [],
    description: String(description ?? "").slice(0, 300),
    color: "#64748B", likes: 0, downloads: 0,
    lighting: state.lighting, multisensory: state.multisensory,
    biometric: state.biometric, createdAt: new Date().toISOString(),
  };
  getMemory().community.unshift(profile);
  emit("community_new_profile", profile);
  res.json({ ok: true, profile });
});

router.post("/like/:id", (req, res) => {
  const { id } = req.params;
  const delta = clampNum(req.body?.delta, -1, 1, 1);
  const p = allProfiles().find(x => x.id === id);
  if (!p) return res.json({ ok: true, likes: 0 });
  p.likes = Math.max(0, (p.likes ?? 0) + delta);
  res.json({ ok: true, likes: p.likes });
});

router.post("/apply/:id", (req, res) => {
  const p = allProfiles().find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Profile not found" });
  const state = getState();
  if (p.scene)        { state.activeScene = p.scene; emit("scene_change", { scene: p.scene }); }
  if (p.multisensory) Object.keys(p.multisensory).forEach(k => { if (state.multisensory[k]) state.multisensory[k] = { ...state.multisensory[k], ...p.multisensory[k] }; });
  emit("multisensory_update", { all: state.multisensory });
  p.downloads = (p.downloads ?? 0) + 1;
  runPipeline();
  res.json({ ok: true });
});

export default router;
