import type { CharacterId, PlayerId } from "@erroroid/shared";
import { findSlot } from "./Board.js";
import type { GameState } from "./GameState.js";

export interface OliverTriggerDecision {
  readonly fires: boolean;
  readonly oliverOwner?: PlayerId;
}

/**
 * オリバーの常在トリガー(checkForceOpenとは完全に独立した別枠の判定):
 * 自分のターン中の自発オープンでは効果不発動(oliverのeffectスクリプト自体が空なので、
 * ここでは扱わない)。相手ターン中に証拠が変動し、このカードの証拠が丁度4になった
 * 瞬間だけ発動する。
 *
 * mutatedOwner/mutatedCharacter/previousEvidence は「今まさに書き換えられた1スロット」の
 * 変化前後を表す。EffectResolverが証拠を変更するたびにこの関数を呼び出す。
 */
export function decideOliverTrigger(
  state: GameState,
  mutatedOwner: PlayerId,
  mutatedCharacter: CharacterId,
  previousEvidence: number,
  actingPlayer: PlayerId,
): OliverTriggerDecision {
  if (mutatedCharacter !== "oliver") return { fires: false };
  if (mutatedOwner === actingPlayer) return { fires: false }; // 自分のターン中は不発動

  const slot = findSlot(state[mutatedOwner].board, "oliver");
  if (slot.isOpen) return { fires: false };
  if (previousEvidence === 4 || slot.evidence !== 4) return { fires: false }; // 「丁度4になった瞬間」のみ

  return { fires: true, oliverOwner: mutatedOwner };
}
