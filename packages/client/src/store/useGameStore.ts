import type {
  ActionResultPayload,
  CharacterId,
  ChooseDiscardRequestPayload,
  ChooseTargetsRequestPayload,
  DeductionCardId,
  EffectLogEntry,
  GameView,
  JoinResponse,
  LobbyStatusPayload,
  PlayerId,
  Seat,
  SubmitErroroidChoiceResult,
  TargetRef,
} from "@erroroid/shared";
import { create } from "zustand";
import { socket } from "../socket";

export type LobbyPhase = "waitingForPlayers" | "waitingForErroroidChoices" | "inGame";

/** 対応するまで次の行動をブロックする通知。相手の操作結果(カード使用等)か、自分の番になったこと、のどちらか。 */
export type Notice =
  | { readonly kind: "log"; readonly entries: readonly EffectLogEntry[] }
  | { readonly kind: "turnStart" };

interface GameStore {
  connected: boolean;
  roomToken: string | null;
  seat: Seat | null;
  perspective: PlayerId | "spectator" | null;
  lobbyPhase: LobbyPhase | null;
  playerCount: number;
  view: GameView | null;
  pendingTargetsRequest: ChooseTargetsRequestPayload | null;
  pendingDiscardRequest: ChooseDiscardRequestPayload | null;
  joinError: string | null;
  joinNotice: string | null;
  lastActionError: string | null;
  actionLog: EffectLogEntry[];
  /** 未確認の通知キュー。先頭(pendingNotices[0])だけをモーダル表示し、確認済みから順に消化する。 */
  pendingNotices: Notice[];
  /** action送信からactionResult受信までの間true。多重送信を防ぐガード。 */
  actionInFlight: boolean;

  joinRoom: (roomToken: string) => void;
  submitErroroidChoice: (character: CharacterId) => void;
  playDeductionCard: (cardId: DeductionCardId) => void;
  openAndroid: (character: CharacterId) => void;
  useReveal: () => void;
  endTurn: () => void;
  respondChooseTargets: (chosen: TargetRef[]) => void;
  respondChooseDiscard: (picked: DeductionCardId) => void;
  dismissNotice: () => void;
}

function sessionKey(roomToken: string): string {
  return `erroroid:session:${roomToken}`;
}

function isPlayerSeat(seat: Seat | null): seat is "player1" | "player2" {
  return seat === "player1" || seat === "player2";
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  roomToken: null,
  seat: null,
  perspective: null,
  lobbyPhase: null,
  playerCount: 0,
  view: null,
  pendingTargetsRequest: null,
  pendingDiscardRequest: null,
  joinError: null,
  joinNotice: null,
  lastActionError: null,
  actionLog: [],
  pendingNotices: [],
  actionInFlight: false,

  joinRoom: (roomToken) => {
    const sessionToken = sessionStorage.getItem(sessionKey(roomToken)) ?? undefined;
    set({ roomToken, joinError: null, joinNotice: null });
    socket.emit("join", { roomToken, sessionToken });
  },

  submitErroroidChoice: (character) => {
    socket.emit("submitErroroidChoice", { character });
  },

  playDeductionCard: (cardId) => {
    const { seat, actionInFlight } = get();
    if (!isPlayerSeat(seat) || actionInFlight) return;
    set({ actionInFlight: true });
    socket.emit("action", { action: { type: "playDeductionCard", player: seat, cardId } });
  },

  openAndroid: (character) => {
    const { seat, actionInFlight } = get();
    if (!isPlayerSeat(seat) || actionInFlight) return;
    set({ actionInFlight: true });
    socket.emit("action", { action: { type: "openAndroid", player: seat, character } });
  },

  useReveal: () => {
    const { seat, actionInFlight } = get();
    if (!isPlayerSeat(seat) || actionInFlight) return;
    set({ actionInFlight: true });
    socket.emit("action", { action: { type: "useReveal", player: seat } });
  },

  endTurn: () => {
    const { seat, actionInFlight } = get();
    if (!isPlayerSeat(seat) || actionInFlight) return;
    set({ actionInFlight: true });
    socket.emit("action", { action: { type: "endTurn", player: seat } });
  },

  respondChooseTargets: (chosen) => {
    const { pendingTargetsRequest } = get();
    if (!pendingTargetsRequest) return;
    socket.emit("chooseTargetsResponse", { requestId: pendingTargetsRequest.requestId, chosen });
    set({ pendingTargetsRequest: null });
  },

  respondChooseDiscard: (picked) => {
    const { pendingDiscardRequest } = get();
    if (!pendingDiscardRequest) return;
    socket.emit("chooseDiscardResponse", { requestId: pendingDiscardRequest.requestId, picked });
    set({ pendingDiscardRequest: null });
  },

  dismissNotice: () => set((state) => ({ pendingNotices: state.pendingNotices.slice(1) })),
}));

/**
 * actionResult/logEntries共通: 履歴ログ(actionLog)には常に積み増す。
 * 通知モーダル(pendingNotices)は自分の操作結果には出さない(自分は選択画面等で既に経緯を見ているため)。
 * 相手の操作(logEntries経由)の時だけ通知キューに積み、OKを押すまで次の行動をブロックする。
 */
function ingestLog(log: readonly EffectLogEntry[] | undefined, notify: boolean): void {
  if (!log || log.length === 0) return;
  useGameStore.setState((state) => ({
    actionLog: [...state.actionLog, ...log],
    pendingNotices: notify ? [...state.pendingNotices, { kind: "log", entries: log }] : state.pendingNotices,
  }));
}

// ソケットイベント配線(モジュール読み込み時に一度だけ登録する)
// "connect" は初回接続だけでなく、通信の瞬断やRender無料枠のスリープ復帰後の
// 再接続時にも毎回発火する。再接続後のソケットはサーバー側で座席未登録の状態から
// 始まるため、既に入室済み(roomTokenあり)なら保存済みのsessionTokenで再joinし、
// 座席とアクション待ち状態(対象選択など)を復元しないと、次の操作が
// "not joined" エラーになってしまう。
socket.on("connect", () => {
  useGameStore.setState({ connected: true });
  const { roomToken } = useGameStore.getState();
  if (roomToken) {
    const sessionToken = sessionStorage.getItem(sessionKey(roomToken)) ?? undefined;
    socket.emit("join", { roomToken, sessionToken });
  }
});
// 切断時、応答が二度と届かないactionでUIが固まったままにならないようガードも解除する。
socket.on("disconnect", () => useGameStore.setState({ connected: false, actionInFlight: false }));

socket.on("joinResult", (payload: JoinResponse) => {
  if (!payload.ok) {
    useGameStore.setState({ joinError: payload.reason });
    return;
  }
  const { roomToken } = useGameStore.getState();
  if (roomToken) {
    sessionStorage.setItem(sessionKey(roomToken), payload.sessionToken);
  }
  let joinNotice: string | null = null;
  if (payload.previousSessionNote === "reservation_expired") {
    joinNotice = "座席の予約期限が切れました。もう一度参加し直してください。";
  } else if (payload.previousSessionNote === "server_restarted") {
    joinNotice = "サーバーが再起動されたためゲームが失われました。新しく部屋を作り直してください。";
  }
  useGameStore.setState({
    seat: payload.seat,
    perspective: isPlayerSeat(payload.seat) ? payload.seat : "spectator",
    lobbyPhase: payload.lobbyPhase,
    view: payload.view ?? null,
    joinError: null,
    joinNotice,
  });
});

socket.on("lobbyStatus", (payload: LobbyStatusPayload) => {
  useGameStore.setState({ lobbyPhase: payload.lobbyPhase, playerCount: payload.playerCount });
});

socket.on("view", (payload: GameView) => {
  const { view: previousView, perspective } = useGameStore.getState();
  // 相手がターンを終えて自分の手番が来た瞬間だけ、確認するまでブロックする通知を立てる
  // (最初にゲーム開始直後に見るビューは対象外にするため、直前のviewが存在する場合のみ判定する)。
  const becameMyTurn =
    previousView !== null &&
    previousView.turn !== payload.turn &&
    (perspective === "player1" || perspective === "player2") &&
    payload.turn === perspective;
  useGameStore.setState((state) => ({
    view: payload,
    lobbyPhase: "inGame",
    pendingNotices: becameMyTurn ? [...state.pendingNotices, { kind: "turnStart" }] : state.pendingNotices,
  }));
});

socket.on("actionResult", (payload: ActionResultPayload) => {
  useGameStore.setState({
    lastActionError: payload.ok ? null : (payload.error ?? "unknown error"),
    actionInFlight: false,
  });
  ingestLog(payload.log, false);
});

socket.on("logEntries", (log: EffectLogEntry[]) => {
  ingestLog(log, true);
});

socket.on("submitErroroidChoiceResult", (payload: SubmitErroroidChoiceResult) => {
  useGameStore.setState({ lastActionError: payload.ok ? null : payload.error });
});

socket.on("chooseTargetsRequest", (payload: ChooseTargetsRequestPayload) => {
  useGameStore.setState({ pendingTargetsRequest: payload });
});

socket.on("chooseDiscardRequest", (payload: ChooseDiscardRequestPayload) => {
  useGameStore.setState({ pendingDiscardRequest: payload });
});
