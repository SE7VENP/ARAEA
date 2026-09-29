/**
 * Sidebar navigation items.
 * `s3: true` marks Stage 3 features for highlighting.
 *
 * @typedef {{ id:string, label:string, s3?:boolean }} NavItem
 */
export const NAV = /** @type {NavItem[]} */ ([
  { id:"dashboard",    label:"Dashboard",        desc:"Emotion detection, visualizer & now playing"  },
  { id:"visualizer",   label:"Visualizer",        desc:"Full-screen audio-reactive canvas"            },
  { id:"biometrics",   label:"Biometrics",        desc:"Heart rate, HRV & stress monitoring", s3:true },
  { id:"therapy",      label:"Therapy",           desc:"Breathwork, focus & therapy sessions", s3:true },
  { id:"voice",        label:"Voice & Gesture",   desc:"Voice commands & gesture control", s3:true    },
  { id:"multisensory", label:"Multi-Sensory",     desc:"Smart lights, fan & aroma control", s3:true   },
  { id:"community",    label:"Community",         desc:"Share & explore ambient environments", s3:true },
  { id:"insights",     label:"AI Insights",       desc:"AI mood analysis & recommendations", s3:true  },
  { id:"sensors",      label:"Sensors",           desc:"IoT sensor data & simulation"                },
  { id:"history",      label:"History",           desc:"Mood timeline & recently played"             },
  { id:"settings",     label:"Settings",          desc:"Spotify connection & system status"          },
  { id:"theme",        label:"Theme & Colors",    desc:"Customize the UI appearance"                },
]);
