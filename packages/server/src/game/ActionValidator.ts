import {
  ANDROID_CARD_DEFS,
  computeRevealCost,
  DEDUCTION_CARD_DEFS,
  REVEAL_CARD_DEFS,
  type GameAction,
} from "@erroroid/shared";
import { findSlot } from "./Board.js";
import type { GameState } from "./GameState.js";

export type { GameAction } from "@erroroid/shared";

export interface ValidationResult {
  readonly ok: boolean;
  readonly error?: string;
}

const ok: ValidationResult = { ok: true };
function fail(error: string): ValidationResult {
  return { ok: false, error };
}

/**
 * 手番・フェーズ・コスト・対象の正当性を検証する。観戦者はそもそもGameAction自体を
 * 生成する権限がない(ネットワーク層で弾く)ため、ここでは「手番のプレイヤー本人か」までを見る。
 */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  if (state.phase === "gameOver") return fail("game is already over");
  if (action.player !== state.turn) return fail("not your turn");
  if (state.phase !== "thinking") return fail("not in thinking phase");

  const player = state[action.player];

  switch (action.type) {
    case "endTurn":
      return ok;

    case "playDeductionCard": {
      if (!player.hand.includes(action.cardId)) return fail("card not in hand");
      const cost = DEDUCTION_CARD_DEFS[action.cardId].cost;
      if (player.tokens.memory < cost) return fail("insufficient insight tokens");
      return ok;
    }

    case "openAndroid": {
      const slot = findSlot(player.board, action.character);
      if (slot.isOpen) return fail("already open");
      const cost = ANDROID_CARD_DEFS[action.character].cost;
      if (player.tokens.memory < cost) return fail("insufficient insight tokens");
      return ok;
    }

    case "useReveal": {
      if (!player.revealCardAvailable) return fail("reveal card already used");
      const openedOwnCount = player.board.filter((s) => s.isOpen).length;
      const cost = computeRevealCost(REVEAL_CARD_DEFS[player.revealCardId], openedOwnCount);
      if (player.tokens.memory < cost) return fail("insufficient insight tokens");
      return ok;
    }

    default: {
      const _exhaustive: never = action;
      return fail(`unknown action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
