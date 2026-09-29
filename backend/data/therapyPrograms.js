/**
 * Therapy programme definitions.
 * Each programme drives the TherapyService state machine.
 */
export const THERAPY_PROGRAMS = {
  breathwork: {
    name: "4-7-8 Breathing",
    desc: "Activates the parasympathetic nervous system.",
    color: "#06B6D4", icon: "🌬", duration: 600, scene: "relax",
    targetHR: 65, targetStress: 25,
    phases: [
      { name:"inhale",  duration:4,  instruction:"Breathe in slowly through your nose" },
      { name:"hold",    duration:7,  instruction:"Hold gently — let your body absorb" },
      { name:"exhale",  duration:8,  instruction:"Release slowly through your mouth" },
    ],
  },
  stress_relief: {
    name: "Stress Relief Protocol",
    desc: "Multi-modal stress reduction.",
    color: "#8B5CF6", icon: "🌿", duration: 900, scene: "sleep",
    targetHR: 62, targetStress: 15,
    phases: [
      { name:"scan",      duration:60,  instruction:"Body scan — notice areas of tension" },
      { name:"release",   duration:120, instruction:"Progressive muscle relaxation" },
      { name:"visualize", duration:120, instruction:"Calm ocean visualization" },
      { name:"integrate", duration:60,  instruction:"Gentle return to awareness" },
    ],
  },
  focus_session: {
    name: "Deep Focus Session",
    desc: "Binaural beat entrainment for flow state.",
    color: "#3B82F6", icon: "🎯", duration: 1800, scene: "focus",
    targetHR: 70, targetStress: 20,
    phases: [
      { name:"warmup",   duration:120,  instruction:"Clear distractions — single point focus" },
      { name:"ramp",     duration:300,  instruction:"Entering flow state — follow the pulse" },
      { name:"flow",     duration:1200, instruction:"Deep work mode engaged" },
      { name:"cooldown", duration:180,  instruction:"Gentle wind-down" },
    ],
  },
  sleep_prep: {
    name: "Sleep Preparation",
    desc: "Circadian wind-down protocol.",
    color: "#4338CA", icon: "🌙", duration: 1200, scene: "sleep",
    targetHR: 58, targetStress: 10,
    phases: [
      { name:"dim",   duration:300, instruction:"Screen-free time — let eyes rest" },
      { name:"relax", duration:300, instruction:"Scan the body from feet to crown" },
      { name:"drift", duration:600, instruction:"Follow your breath into stillness" },
    ],
  },
};
