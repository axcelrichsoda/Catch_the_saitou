import type { AndroidCardEffectDef } from "./types.js";

/**
 * 自分の消費エリアにある推理力を自分の手札と同じ数だけメモリーエリアに戻す。
 * 対象選択を伴わない純粋なトークン操作のため、DSLのcustom逃げ道で実装する。
 * 実体: server/src/cards/customHandlers/lillian.ts の "lillian_recall_insight" ハンドラ。
 */
export const lillian: AndroidCardEffectDef = {
  character: "lillian",
  confidence: "confirmed",
  effect: [{ kind: "custom", handlerId: "lillian_recall_insight" }],
};
