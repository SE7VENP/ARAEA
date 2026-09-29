/**
 * Scene definitions
 *
 * @typedef {{ emoji:string, label:string, col:string, desc:string }} SceneConfig
 */
export const SCENES = /** @type {Record<string,SceneConfig>} */ ({
  focus:   { emoji:"🎯", label:"Focus",   col:"#3b82f6", desc:"Deep work mode" },
  relax:   { emoji:"🌿", label:"Relax",   col:"#10b981", desc:"Wind down"      },
  party:   { emoji:"🎉", label:"Party",   col:"#f59e0b", desc:"High energy"    },
  sleep:   { emoji:"🌙", label:"Sleep",   col:"#6366f1", desc:"Drift off"      },
  wakeup:  { emoji:"☀️", label:"Wake Up", col:"#f97316", desc:"Morning boost"  },
  workout: { emoji:"💪", label:"Workout", col:"#ef4444", desc:"Power through"  },
  cosmic:  { emoji:"🌌", label:"Cosmic",  col:"#8b5cf6", desc:"Deep space"     },
  jazz:    { emoji:"🎷", label:"Jazz",    col:"#d97706", desc:"Late night"     },
});
