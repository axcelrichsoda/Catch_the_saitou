import type { AndroidCardEffectDef } from "./types.js";

/**
 * オリバーは唯一の例外カード:
 * - 自分のターン中に(コストを払って)自らオープンしても効果は一切発動しない → effectは空。
 * - 「相手ターン中に証拠が変動し、このカードの証拠が丁度4になった瞬間オープンし、
 *    その後全アンドロイドの証拠+1」という常在トリガーは、通常のonOpenEffectスクリプトとは
 *    別枠の TriggeredAbility として GameEngine 側(ステップ3)で実装する。
 *    (checkForceOpenの証拠閾値到達によるオープンとも独立した専用ロジックが必要なため)
 */
export const oliver: AndroidCardEffectDef = {
  character: "oliver",
  confidence: "confirmed",
  effect: [],
};
