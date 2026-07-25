import type { GameView, PlayerId, PlayerViewData } from "@erroroid/shared";
import type { GameState, PlayerGameState } from "../game/GameState.js";

export type { GameView, MaskedBoardSlot, PlayerViewData } from "@erroroid/shared";

function maskPlayerView(player: PlayerGameState, isSelf: boolean): PlayerViewData {
  return {
    board: player.board.map((slot) => ({
      character: slot.character,
      isOpen: slot.isOpen,
      evidence: slot.evidence,
      identity: isSelf || slot.isOpen ? slot.identity : undefined,
    })),
    tokens: player.tokens,
    handCount: player.hand.length,
    hand: isSelf ? [...player.hand] : undefined,
    revealCardId: player.revealCardId,
    revealCardAvailable: player.revealCardAvailable,
  };
}

/**
 * GameStateをperspective(player1/player2/観戦者)別にマスクしたビューへ変換する。
 * 観戦者視点はplayer1/player2どちらから見ても isSelf=false のため、
 * 両者の手札・未オープン正体がどちらも伏せられた「公開情報のみ」のビューに自然になる。
 */
export function serializeView(state: GameState, perspective: PlayerId | "spectator"): GameView {
  return {
    perspective,
    player1: maskPlayerView(state.player1, perspective === "player1"),
    player2: maskPlayerView(state.player2, perspective === "player2"),
    deck: { drawCount: state.deck.drawPile.length, discardPile: [...state.deck.discardPile] },
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
  };
}
