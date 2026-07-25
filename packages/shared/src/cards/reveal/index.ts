import type { CardEffectScript } from "../../effects/script.js";
import type { Confidence } from "../../types/core.js";

export const REVEAL_CARD_IDS = ["revealFirst", "revealSecond"] as const;
export type RevealCardId = (typeof REVEAL_CARD_IDS)[number];

export interface RevealCardDef {
  readonly id: RevealCardId;
  readonly displayName: string;
  /** 先攻13/後攻12が基準値。実際のコストは computeRevealCost で動的計算する。 */
  readonly baseCost: number;
  readonly confidence: Confidence;
  readonly effect: CardEffectScript;
}

/**
 * 自分はアンドロイドを1体選択しオープンする(自分→相手の場)。当てればERROROIDが開き即勝利。
 * 実物カードで文言・コスト計算例(3体オープンで先攻10/後攻9)とも照合済み。
 */
const revealEffect: CardEffectScript = [
  { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "target" },
  { kind: "forceOpen", target: "target" },
];

export const REVEAL_CARD_DEFS: Readonly<Record<RevealCardId, RevealCardDef>> = {
  revealFirst: {
    id: "revealFirst",
    displayName: "真相解明(先攻用)",
    baseCost: 13,
    confidence: "confirmed",
    effect: revealEffect,
  },
  revealSecond: {
    id: "revealSecond",
    displayName: "真相解明(後攻用)",
    baseCost: 12,
    confidence: "confirmed",
    effect: revealEffect,
  },
};

/** 動的コスト = baseCost - 自分の場でオープン済みのアンドロイド枚数(0未満にはならない)。 */
export function computeRevealCost(def: RevealCardDef, openedOwnAndroidCount: number): number {
  return Math.max(0, def.baseCost - openedOwnAndroidCount);
}
