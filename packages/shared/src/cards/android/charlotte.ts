import type { AndroidCardEffectDef } from "./types.js";

/** 相手はアンドロイドを1体選択し、それをオープンする */
export const charlotte: AndroidCardEffectDef = {
  character: "charlotte",
  confidence: "confirmed",
  effect: [
    { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "target" },
    { kind: "forceOpen", target: "target" },
  ],
};
