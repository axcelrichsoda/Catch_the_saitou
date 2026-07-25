import type { CardEffectScript } from "../../effects/script.js";
import type { CharacterId, Confidence } from "../../types/core.js";

/**
 * アンドロイドカードの効果定義(オープン条件パターン3=自発的コスト支払いによるオープン時のみ発動)。
 * コスト・カードNo・アリバイは types/core.ts の ANDROID_CARD_DEFS を正とする。
 */
export interface AndroidCardEffectDef {
  readonly character: CharacterId;
  readonly confidence: Confidence;
  readonly effect: CardEffectScript;
}
