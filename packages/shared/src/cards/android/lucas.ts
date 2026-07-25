import type { AndroidCardEffectDef } from "./types.js";

/**
 * 自分は自分のアンドロイドを1体選択し、それにある証拠を0になるまでマイナスする。
 * その後、相手は相手自身のアンドロイドを1体選択し、それの証拠を先ほどマイナスした数だけプラスする。
 * (1段目は自分の場、2段目は相手の場。自分の疑いを晴らし、その分を相手の場の
 * どれかへ押し付ける効果)
 */
export const lucas: AndroidCardEffectDef = {
  character: "lucas",
  confidence: "confirmed",
  effect: [
    { kind: "selectTarget", chooser: "self", board: "ownerSelf", count: 1, bindAs: "a" },
    { kind: "setEvidence", target: "a", amount: 0, captureDeltaAs: "removed" },
    { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "b" },
    { kind: "addEvidence", target: "b", amount: { ref: "removed" } },
  ],
};
