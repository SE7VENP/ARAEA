/** One-tap activity presets that set scene + timer. */
export const ACTIVITY_PRESETS = {
  study_session:      { name:"Study Session",       icon:"📚", color:"#3B82F6", duration:5400, scene:"focus",  desc:"Pomodoro deep work" },
  morning_activation: { name:"Morning Routine",      icon:"🌅", color:"#F97316", duration:1800, scene:"wakeup", desc:"Energising morning start" },
  power_nap:          { name:"Power Nap",            icon:"😴", color:"#4338CA", duration:1200, scene:"sleep",  desc:"20-min recovery nap" },
  pre_workout:        { name:"Pre-Workout Pump",     icon:"💪", color:"#EF4444", duration:600,  scene:"workout",desc:"10-min activation ritual" },
  coffee_break:       { name:"Coffee Break",         icon:"☕", color:"#D97706", duration:900,  scene:"relax",  desc:"15-min intentional break" },
  creative_flow:      { name:"Creative Flow",        icon:"🎨", color:"#8B5CF6", duration:3600, scene:"cosmic", desc:"Divergent thinking mode" },
};
