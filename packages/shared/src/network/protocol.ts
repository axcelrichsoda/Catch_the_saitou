import type { DeductionCardId } from "../cards/deduction/index.js";
import type { RevealCardId } from "../cards/reveal/index.js";
import type { TargetRef } from "../effects/script.js";
import type { CharacterId, Identity, PlayerId, PlayerTokens } from "../types/core.js";

/** ルーム内の座席。player1/player2以外は観戦者(最大2人)。 */
export type Seat = "player1" | "player2" | "spectator1" | "spectator2";

export function seatToPerspective(seat: Seat): PlayerId | "spectator" {
  return seat === "player1" || seat === "player2" ? seat : "spectator";
}

// --- ゲーム進行アクション(クライアント→サーバー) ---

export type GameAction =
  | { readonly type: "playDeductionCard"; readonly player: PlayerId; readonly cardId: DeductionCardId }
  | { readonly type: "openAndroid"; readonly player: PlayerId; readonly character: CharacterId }
  | { readonly type: "useReveal"; readonly player: PlayerId }
  | { readonly type: "endTurn"; readonly player: PlayerId };

/**
 * 対象選択(chooseTargetsRequest)が「どのカードの効果によるものか」を表す。
 * 選択を求められる側(特にchooser:'opponent'で相手に選ばせるカードの相手側)が、
 * 何も文脈が分からないまま「対象を選択してください」だけ見せられることのないよう、
 * カードの絵柄・効果文を先に提示するために使う。
 */
export type EffectSource =
  | { readonly kind: "deductionCard"; readonly cardId: DeductionCardId }
  | { readonly kind: "androidCard"; readonly character: CharacterId }
  | { readonly kind: "revealCard"; readonly revealCardId: RevealCardId };

// --- 効果解決ログ(EffectResolverの出力、クライアントへも送られる) ---

export type EffectLogEntry =
  | { readonly kind: "cardPlayed"; readonly owner: PlayerId; readonly cardId: DeductionCardId }
  | {
      /** 対象の証拠が実際に増減したことを示す(選択の結果を相手にも分かるようにするための通知用) */
      readonly kind: "evidenceChanged";
      readonly owner: PlayerId;
      readonly character: CharacterId;
      readonly before: number;
      readonly after: number;
    }
  | { readonly kind: "open"; readonly owner: PlayerId; readonly character: CharacterId; readonly identity: Identity }
  | {
      readonly kind: "truthAnswer";
      readonly question: "isTargetErroroid" | "existsInFilteredSet";
      readonly answer: boolean;
      readonly targetOwner?: PlayerId;
      readonly targetCharacter?: CharacterId;
      readonly boardOwner?: PlayerId;
    }
  | {
      /** オリバーの常在トリガー(相手ターン中に証拠が丁度4になった瞬間)が発動し、全アンドロイド証拠+1が適用されたことを示す */
      readonly kind: "oliverTriggered";
      readonly owner: PlayerId;
    };

// --- 秘匿マスク済みビュー(サーバー→クライアント) ---

export interface MaskedBoardSlot {
  readonly character: CharacterId;
  readonly isOpen: boolean;
  readonly evidence: number;
  readonly identity?: Identity;
}

export interface PlayerViewData {
  readonly board: readonly MaskedBoardSlot[];
  readonly tokens: PlayerTokens;
  readonly handCount: number;
  readonly hand?: readonly DeductionCardId[];
  readonly revealCardId: RevealCardId;
  readonly revealCardAvailable: boolean;
}

export interface GameView {
  readonly perspective: PlayerId | "spectator";
  readonly player1: PlayerViewData;
  readonly player2: PlayerViewData;
  readonly deck: { readonly drawCount: number; readonly discardPile: readonly DeductionCardId[] };
  readonly turn: PlayerId;
  readonly phase: "draw" | "install" | "thinking" | "gameOver";
  readonly winner?: PlayerId;
}

// --- ソケットイベントのペイロード ---

export interface JoinRequest {
  readonly roomToken: string;
  readonly sessionToken?: string;
}

export type PreviousSessionNote = "reservation_expired" | "server_restarted";

export type JoinResponse =
  | {
      readonly ok: true;
      readonly seat: Seat;
      readonly sessionToken: string;
      readonly reconnected: boolean;
      readonly previousSessionNote?: PreviousSessionNote;
      readonly view?: GameView;
      readonly lobbyPhase: "waitingForPlayers" | "waitingForErroroidChoices" | "inGame";
    }
  | { readonly ok: false; readonly reason: "room_not_found" | "room_full" };

export interface SubmitErroroidChoiceRequest {
  readonly character: CharacterId;
}

export type SubmitErroroidChoiceResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface ActionRequest {
  readonly action: GameAction;
}

export interface ActionResultPayload {
  readonly ok: boolean;
  readonly error?: string;
  readonly log?: readonly EffectLogEntry[];
}

export interface LobbyStatusPayload {
  readonly lobbyPhase: "waitingForPlayers" | "waitingForErroroidChoices" | "inGame";
  readonly playerCount: number;
}

export interface ChooseTargetsRequestPayload {
  readonly requestId: string;
  readonly candidates: readonly TargetRef[];
  readonly count: number;
  readonly source?: EffectSource;
}

export interface ChooseTargetsResponsePayload {
  readonly requestId: string;
  readonly chosen: readonly TargetRef[];
}

export interface ChooseDiscardRequestPayload {
  readonly requestId: string;
  readonly candidates: readonly DeductionCardId[];
}

export interface ChooseDiscardResponsePayload {
  readonly requestId: string;
  readonly picked: DeductionCardId;
}
