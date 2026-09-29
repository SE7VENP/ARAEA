/** /api/voice — voice command processing */
import { Router }  from "express";
import { getState, emit, emitState } from "../services/StateService.js";
import { runPipeline }               from "../services/PipelineService.js";
import { start as startTherapy, stop as stopTherapy } from "../services/TherapyService.js";

const COMMAND_MAP = [
  { pattern: /party|dance/,           scene: "party"   },
  { pattern: /focus|work/,            scene: "focus"   },
  { pattern: /relax|calm/,            scene: "relax"   },
  { pattern: /sleep|bed/,             scene: "sleep"   },
  { pattern: /workout|gym/,           scene: "workout" },
  { pattern: /cosmic|space/,          scene: "cosmic"  },
  { pattern: /wakeup|wake up|morning/,scene: "wakeup"  },
];

const router = Router();

router.post("/", (req, res) => {
  const cmd   = String(req.body?.transcript ?? "").toLowerCase().slice(0, 200);
  const state = getState();
  let result  = { recognized: false, action: null };

  const sceneMatch = COMMAND_MAP.find(({ pattern }) => pattern.test(cmd));
  if (sceneMatch) {
    state.activeScene = sceneMatch.scene;
    result = { recognized: true, action: `scene:${sceneMatch.scene}` };
  } else if (/lights on|turn on/.test(cmd))  { state.multisensory.ledStrip.active = true;  result = { recognized:true, action:"lights:on"  }; }
  else if (/lights off|turn off/.test(cmd))  { state.multisensory.ledStrip.active = false; result = { recognized:true, action:"lights:off" }; }
  else if (/brighter/.test(cmd))             { state.multisensory.ledStrip.brightness = Math.min(100, state.multisensory.ledStrip.brightness + 20); result = { recognized:true, action:"brightness:up"   }; }
  else if (/dimmer|dim/.test(cmd))           { state.multisensory.ledStrip.brightness = Math.max(10,  state.multisensory.ledStrip.brightness - 20); result = { recognized:true, action:"brightness:down" }; }
  else if (/therapy|breathe/.test(cmd))      { startTherapy("breathwork"); result = { recognized:true, action:"therapy:breathwork" }; }
  else if (/stop therapy/.test(cmd))         { stopTherapy();              result = { recognized:true, action:"therapy:stop"       }; }
  else if (/fan on/.test(cmd))               { state.multisensory.fan.active = true;  result = { recognized:true, action:"fan:on"  }; }
  else if (/fan off/.test(cmd))              { state.multisensory.fan.active = false; result = { recognized:true, action:"fan:off" }; }

  if (result.recognized) {
    emit("voice_command", { transcript: cmd, ...result });
    emitState({ activeScene: state.activeScene, multisensory: state.multisensory });
    runPipeline();
  }
  res.json(result);
});

export default router;
