/** Presentation Hub data — moment definitions and room presets. */
export const PRESENTATION_MOMENTS = {
  opening:  { name:"Opening",     icon:"🎬", color:"#3B82F6", desc:"Hook the audience",   lighting:{brightness:90}, music:"energetic" },
  explain:  { name:"Explanation", icon:"📚", color:"#10B981", desc:"Clear & focused",     lighting:{brightness:80}, music:"focus"     },
  demo:     { name:"Demo Time",   icon:"🚀", color:"#F97316", desc:"Show, don't tell",    lighting:{brightness:95}, music:"energetic" },
  qa:       { name:"Q&A",         icon:"🙋", color:"#8B5CF6", desc:"Open discussion",     lighting:{brightness:75}, music:"calm"      },
  closing:  { name:"Closing",     icon:"🎯", color:"#1DB954", desc:"Call to action",      lighting:{brightness:85}, music:"uplifting" },
  break_:   { name:"Break",       icon:"☕", color:"#D97706", desc:"15 min recharge",     lighting:{brightness:60}, music:"relaxed"   },
};

export const ROOM_PRESETS = {
  bedroom:  { name:"Bedroom",     icon:"🛏",  desc:"Sleep-friendly warm dim" },
  office:   { name:"Office",      icon:"💼",  desc:"Productive cool light"   },
  living:   { name:"Living Room", icon:"🛋",  desc:"Warm ambient comfort"    },
  kitchen:  { name:"Kitchen",     icon:"🍳",  desc:"Bright task lighting"    },
  gym:      { name:"Gym",         icon:"🏋",  desc:"High energy intensity"   },
  cinema:   { name:"Cinema",      icon:"🎬",  desc:"Dark theatrical mode"    },
};

export const MOMENT_SCENE_MAP = {
  energetic: "party", focus: "focus", calm: "relax",
  relaxed: "relax", uplifting: "wakeup",
};
