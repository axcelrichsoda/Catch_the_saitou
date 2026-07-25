import type { AndroidCardEffectDef } from "./types.js";

/**
 * 相手はアンドロイドを1体選択し、それに証拠+4。これを2回繰り返す(同じアンドロイドを複数回選択しても良い)。
 */
export const saint: AndroidCardEffectDef = {
  character: "saint",
  confidence: "confirmed",
  effect: [
    {
      kind: "repeat",
      times: 2,
      steps: [
        { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "target" },
        { kind: "addEvidence", target: "target", amount: 4 },
      ],
    },
  ],
};
