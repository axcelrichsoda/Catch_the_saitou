import type { CharacterId, PlayerId } from "@erroroid/shared";
import type { GameAction } from "../game/ActionValidator.js";
import { dispatch, createInitialGameState, type DispatchResult } from "../game/GameEngine.js";
import type { EffectChooser } from "../game/EffectResolver.js";
import type { GameState } from "../game/GameState.js";
import { RoomManager } from "./RoomManager.js";
import { serializeView, type GameView } from "./ViewSerializer.js";

export type RoomLobbyPhase = "waitingForPlayers" | "waitingForErroroidChoices" | "inGame";

export type SubmitErroroidResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * ルームURLに紐づく1ゲームぶんの状態。座席管理(RoomManager)、
 * 対戦開始前のロビー(犯人選択待ち)、ゲーム本体(GameState/GameEngine)をまとめて扱う。
 */
export class Room {
  readonly token: string;
  readonly manager: RoomManager;
  private readonly rng: () => number;
  private erroroidChoices: Partial<Record<PlayerId, CharacterId>> = {};
  private gameState: GameState | undefined;
  /** dispatch呼び出しを発生順に直列化するためのキュー(同時アクションの競合を防ぐ)。 */
  private pending: Promise<unknown> = Promise.resolve();

  constructor(token: string, manager: RoomManager = new RoomManager(), rng: () => number = Math.random) {
    this.token = token;
    this.manager = manager;
    this.rng = rng;
  }

  get lobbyPhase(): RoomLobbyPhase {
    if (this.gameState) return "inGame";
    if (this.manager.playerCount() < 2) return "waitingForPlayers";
    return "waitingForErroroidChoices";
  }

  /** 各プレイヤーが自分の犯人キャラクターを秘密裏に選択する。両者提出済みでゲームが始まる。 */
  submitErroroidChoice(player: PlayerId, character: CharacterId): SubmitErroroidResult {
    if (this.gameState) return { ok: false, error: "game already started" };
    if (this.manager.playerCount() < 2) return { ok: false, error: "waiting for both players to join" };

    this.erroroidChoices = { ...this.erroroidChoices, [player]: character };

    const { player1, player2 } = this.erroroidChoices;
    if (player1 && player2) {
      // 現物ルールのじゃんけんに相当する、公平な先攻/後攻のランダム決定。
      const firstPlayer: PlayerId = this.rng() < 0.5 ? "player1" : "player2";
      this.gameState = createInitialGameState({
        firstPlayer,
        player1Erroroid: player1,
        player2Erroroid: player2,
        rng: this.rng,
      });
    }
    return { ok: true };
  }

  getState(): GameState | undefined {
    return this.gameState;
  }

  /**
   * dispatchは呼び出し順に直列実行する(同時に複数のactionが飛んできても、
   * 前のdispatchのgameState読み取り→書き込みが完了してから次のdispatchが読み取りを始める)。
   * こうしないと、2つのdispatchが同じ古いgameStateを読み取って処理し、
   * 後から書き込んだ方が前の結果を静かに上書きしてしまう競合状態になる。
   */
  dispatch(action: GameAction, chooser: EffectChooser): Promise<DispatchResult> {
    const result = this.pending.catch(() => undefined).then(() => this.runDispatch(action, chooser));
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async runDispatch(action: GameAction, chooser: EffectChooser): Promise<DispatchResult> {
    if (!this.gameState) {
      throw new Error("game has not started yet");
    }
    const result = await dispatch(this.gameState, action, chooser);
    this.gameState = result.state;
    return result;
  }

  getView(perspective: PlayerId | "spectator"): GameView | undefined {
    if (!this.gameState) return undefined;
    return serializeView(this.gameState, perspective);
  }
}
