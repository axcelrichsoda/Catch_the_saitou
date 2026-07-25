import type { AndroidCardEffectDef } from "./types.js";

/**
 * 自分はアンドロイドを1体選択し、それに証拠+1。これを3回繰り返す(同じアンドロイドを複数回選択しても良い)。
 * 対象の場は相手の場(通常の攻撃的選択)。
 */
export const ivy: AndroidCardEffectDef = {
  character: "ivy",
  confidence: "confirmed",
  effect: [
    {
      kind: "repeat",
      times: 3,
      steps: [
        { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "target" },
        { kind: "addEvidence", target: "target", amount: 1 },
      ],
    },
  ],
};
