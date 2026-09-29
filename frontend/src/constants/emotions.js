/**
 * Emotion definitions
 *
 * @typedef {{ emoji:string, col:string, bg:string, label:string, desc:string }} EmotionConfig
 */
export const MOODS = /** @type {Record<string,EmotionConfig>} */ ({
  euphoric:    { emoji:"🔥", col:"#ef4444", bg:"#fef2f2", label:"Euphoric",    desc:"High energy · elevated"   },
  happy:       { emoji:"✨", col:"#f59e0b", bg:"#fffbeb", label:"Happy",       desc:"Positive · uplifting"     },
  calm:        { emoji:"🌊", col:"#0ea5e9", bg:"#f0f9ff", label:"Calm",        desc:"Serene · peaceful"        },
  melancholic: { emoji:"🌧", col:"#8b5cf6", bg:"#f5f3ff", label:"Melancholic", desc:"Subdued · atmospheric"    },
  tense:       { emoji:"⚡", col:"#f43f5e", bg:"#fff1f2", label:"Tense",       desc:"Intense · aggressive"     },
  sad:         { emoji:"💧", col:"#3b82f6", bg:"#eff6ff", label:"Sad",         desc:"Low valence · slow"       },
  neutral:     { emoji:"◎",  col:"#64748b", bg:"#f8fafc", label:"Neutral",     desc:"Balanced · moderate"      },
  // face-api emits these — must exist in MOODS or dashboard gets em=undefined
  angry:       { emoji:"😠", col:"#dc2626", bg:"#fef2f2", label:"Angry",       desc:"Frustrated · hostile"     },
  energetic:   { emoji:"🚀", col:"#10b981", bg:"#ecfdf5", label:"Energetic",   desc:"Active · driven"          },
  surprised:   { emoji:"😲", col:"#f97316", bg:"#fff7ed", label:"Surprised",   desc:"Alert · unexpected"       },
  fearful:     { emoji:"😨", col:"#7c3aed", bg:"#f5f3ff", label:"Fearful",     desc:"Anxious · unsettled"      },
});

/** Emotion labels the user can select manually. */
export const EMOTIONS = /** @type {string[]} */ (
  ["neutral","happy","sad","angry","calm","energetic","surprised","fearful","euphoric","melancholic","tense"]
);

/** Quick emoji lookup by emotion label. */
export const EMO_EMOJI = /** @type {Record<string,string>} */ (
  Object.fromEntries(Object.entries(MOODS).map(([k,v]) => [k, v.emoji]))
);
