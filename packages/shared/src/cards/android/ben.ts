import type { AndroidCardEffectDef } from "./types.js";

/**
 * 相手は証拠が2以上あるアンドロイドの中に、エラーロイドが「いる」か「いない」か答える
 * (証拠2以上のアンドロイドがなければ発動しない)。個別の対象選択ではなく、
 * 「条件を満たす集合の中にERROROIDが存在するか」という存在質問。
 */
export const ben: AndroidCardEffectDef = {
  character: "ben",
  confidence: "confirmed",
  effect: [
    {
      kind: "askTruth",
      mode: "existsInFilteredSet",
      answerer: "opponent",
      board: "ownerOpponent",
      filter: { minEvidence: 2 },
    },
  ],
};
