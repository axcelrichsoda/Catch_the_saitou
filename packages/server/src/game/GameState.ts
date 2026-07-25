import type { BoardSlot, DeductionCardId, PlayerId, PlayerTokens, RevealCardId } from "@erroroid/shared";
import type { DeckState } from "./Deck.js";

export type Phase = "draw" | "install" | "thinking" | "gameOver";

/**
 * 1プレイヤー分のゲーム内秘匿状態。サーバーメモリにのみ存在し、
 * クライアントには ViewSerializer(ステップ3)でマスクしたビューのみを送る。
 */
export interface PlayerGameState {
  readonly board: BoardSlot[];
  readonly tokens: PlayerTokens;
  readonly hand: DeductionCardId[];
  readonly revealCardId: RevealCardId;
  /**
   * 自分のリヴィールカードが現在使用可能(リヴィールエリアにある)かどうか。
   * 使用後はカードを裏返して以降使用不可となる仕様のため、falseになったら
   * ゲーム終了まで二度とtrueには戻らない(廃棄場には送らず、証拠回収による
   * 再取得の対象にもならない)。
   */
  readonly revealCardAvailable: boolean;
}

export interface GameState {
  readonly player1: PlayerGameState;
  readonly player2: PlayerGameState;
  readonly deck: DeckState<DeductionCardId>;
  readonly turn: PlayerId;
  readonly phase: Phase;
  /** ゲーム終了時、勝者を設定する */
  readonly winner?: PlayerId;
}
