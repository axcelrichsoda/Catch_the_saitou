import type { CharacterId, Identity, PlayerId } from "@erroroid/shared";
import { findSlot, openSlot, shouldForceOpen } from "./Board.js";
import type { GameState } from "./GameState.js";

export interface ForceOpenOutcome {
  readonly state: GameState;
  readonly opened: boolean;
  readonly identity?: Identity;
}

/**
 * 証拠がアリバイ以上に達した未オープンカードを、その場でオープンする。
 * 「証拠がアリバイ(体力)以上になった時、即座に(効果発動中でも)強制オープン」というルールを実装するもので、
 * カード効果による証拠変動のたびに(EffectResolver内部から)毎回呼び出される。
 * 通常のアンドロイドは効果を発動しない(単に正体が公開されるだけ)。
 */
export function checkForceOpen(state: GameState, owner: PlayerId, character: CharacterId): ForceOpenOutcome {
  const slot = findSlot(state[owner].board, character);
  if (!shouldForceOpen(slot)) {
    return { state, opened: false };
  }
  const board = openSlot(state[owner].board, character);
  return {
    state: { ...state, [owner]: { ...state[owner], board } },
    opened: true,
    identity: slot.identity,
  };
}
