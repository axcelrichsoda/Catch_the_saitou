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
  /** オリバーの常在トリガーが発動した直後、確認するまで表示し続ける通知(所有者のPlayerId)。 */
  oliverNotice: PlayerId | null;
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
  dismissOliverNotice: () => void;
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
  oliverNotice: null,
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

  dismissOliverNotice: () => set({ oliverNotice: null }),
}));

/** actionResult/logEntries共通: ログを積み増し、オリバー常在トリガーがあれば通知を立てる。 */
function ingestLog(log: readonly EffectLogEntry[] | undefined): void {
  if (!log || log.length === 0) return;
  const oliverEntry = log.find(
    (entry): entry is Extract<EffectLogEntry, { kind: "oliverTriggered" }> => entry.kind === "oliverTriggered",
  );
  useGameStore.setState((state) => ({
    actionLog: [...state.actionLog, ...log],
    oliverNotice: oliverEntry ? oliverEntry.owner : state.oliverNotice,
  }));
}

// ソケットイベント配線(モジュール読み込み時に一度だけ登録する)
socket.on("connect", () => useGameStore.setState({ connected: true }));
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
  useGameStore.setState({ view: payload, lobbyPhase: "inGame" });
});

socket.on("actionResult", (payload: ActionResultPayload) => {
  useGameStore.setState({
    lastActionError: payload.ok ? null : (payload.error ?? "unknown error"),
    actionInFlight: false,
  });
  ingestLog(payload.log);
});

socket.on("logEntries", (log: EffectLogEntry[]) => {
  ingestLog(log);
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
