import type { PlayerId } from "@erroroid/shared";
import type { GameState } from "../../game/GameState.js";
import { returnPartial } from "../../game/Tokens.js";

/**
 * 自分の消費エリアにある推理力を自分の手札と同じ数だけメモリーエリアに戻す。
 * (手札が5枚なら戻せる推理力も5)
 */
export function lillianRecallInsight(state: GameState, actingPlayer: PlayerId): GameState {
  const player = state[actingPlayer];
  const amount = player.hand.length;
  return {
    ...state,
    [actingPlayer]: { ...player, tokens: returnPartial(player.tokens, amount) },
  };
}
