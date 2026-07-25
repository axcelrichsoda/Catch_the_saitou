import { randomUUID } from "node:crypto";
import {
  seatToPerspective,
  type ActionResultPayload,
  type ChooseDiscardRequestPayload,
  type ChooseTargetsRequestPayload,
  type DeductionCardId,
  type EffectLogEntry,
  type JoinResponse,
  type LobbyStatusPayload,
  type Seat,
  type SubmitErroroidChoiceResult,
  type TargetRef,
} from "@erroroid/shared";
import type { EffectChooser } from "../game/EffectResolver.js";
import type { Room } from "./Room.js";
import type { RoomRegistry } from "./RoomRegistry.js";
import {
  actionRequestSchema,
  chooseDiscardResponseSchema,
  chooseTargetsResponseSchema,
  joinRequestSchema,
  submitErroroidChoiceRequestSchema,
} from "./schemas.js";

/**
 * socket.ioの型に直接依存せず、テストではフェイクソケットを差し込めるようにするための
 * 最小インターフェース(socket.ioの実オブジェクトは構造的にこれを満たす)。
 */
export interface ServerSocketLike {
  readonly id: string;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, payload?: unknown): void;
}

export interface ServerIOLike {
  on(event: "connection", handler: (socket: ServerSocketLike) => void): void;
}

interface PendingRequest {
  readonly forSeat: Seat;
  readonly event: string;
  readonly payload: unknown;
  readonly resolve: (value: never) => void;
  readonly reject: (reason?: unknown) => void;
}

interface RoomConnections {
  readonly sockets: Map<string, ServerSocketLike>;
  readonly pendingRequests: Map<string, PendingRequest>;
}

/**
 * selectTarget/selectFromBound/recoverFromDiscardの実際の人間による選択を、
 * 該当プレイヤーの現在の(再接続後は差し替わった)ソケットへのイベント往復として実装する。
 * 応答はrequestId一致でのみ照合するため、選択待ち中に別ソケットへ再接続しても、
 * 新しいソケットからの応答で正しく解決できる。
 */
class SocketEffectChooser implements EffectChooser {
  constructor(
    private readonly room: Room,
    private readonly conns: RoomConnections,
  ) {}

  private sendToSeat(seat: Seat, event: string, payload: unknown): void {
    const socketId = this.room.manager.socketIdFor(seat);
    if (!socketId) return; // 切断中(予約保持期間内)。再接続時にpendingRequestsから再送される。
    this.conns.sockets.get(socketId)?.emit(event, payload);
  }

  selectTargets(args: {
    chooser: Seat & ("player1" | "player2");
    candidates: readonly TargetRef[];
    count: number;
  }): Promise<readonly TargetRef[]> {
    const seat = args.chooser;
    const requestId = randomUUID();
    const payload: ChooseTargetsRequestPayload = { requestId, candidates: args.candidates, count: args.count };
    return new Promise((resolve, reject) => {
      this.conns.pendingRequests.set(requestId, {
        forSeat: seat,
        event: "chooseTargetsRequest",
        payload,
        resolve: resolve as (value: never) => void,
        reject,
      });
      this.sendToSeat(seat, "chooseTargetsRequest", payload);
    });
  }

  chooseDiscardCard(args: {
    chooser: Seat & ("player1" | "player2");
    candidates: readonly DeductionCardId[];
  }): Promise<DeductionCardId> {
    const seat = args.chooser;
    const requestId = randomUUID();
    const payload: ChooseDiscardRequestPayload = { requestId, candidates: args.candidates };
    return new Promise((resolve, reject) => {
      this.conns.pendingRequests.set(requestId, {
        forSeat: seat,
        event: "chooseDiscardRequest",
        payload,
        resolve: resolve as (value: never) => void,
        reject,
      });
      this.sendToSeat(seat, "chooseDiscardRequest", payload);
    });
  }
}

export function registerSocketHandlers(io: ServerIOLike, registry: RoomRegistry): void {
  const roomConnections = new Map<string, RoomConnections>();

  function getOrCreateConnections(roomToken: string): RoomConnections {
    let conns = roomConnections.get(roomToken);
    if (!conns) {
      conns = { sockets: new Map(), pendingRequests: new Map() };
      roomConnections.set(roomToken, conns);
    }
    return conns;
  }

  /**
   * sourceSocketId(操作を行った本人)には actionResult で既にlogを個別送信済みのため、
   * それ以外の全クライアント(対戦相手・観戦者)にだけ logEntries で共有する。
   * これにより、相手の操作によるオリバーの常在トリガー発動なども全員のログ・通知に反映される。
   */
  function broadcast(
    roomToken: string,
    room: Room,
    conns: RoomConnections,
    log?: readonly EffectLogEntry[],
    sourceSocketId?: string,
  ): void {
    for (const [socketId, sock] of conns.sockets) {
      const seat = room.manager.seatFor(socketId);
      if (!seat) continue;
      const view = room.getView(seatToPerspective(seat));
      if (view) {
        sock.emit("view", view);
        if (log && log.length > 0 && socketId !== sourceSocketId) {
          sock.emit("logEntries", log);
        }
      } else {
        const status: LobbyStatusPayload = { lobbyPhase: room.lobbyPhase, playerCount: room.manager.playerCount() };
        sock.emit("lobbyStatus", status);
      }
    }
  }

  io.on("connection", (socket) => {
    let currentRoom: Room | undefined;
    let mySeat: Seat | undefined;

    socket.on("join", (rawPayload) => {
      const parsed = joinRequestSchema.safeParse(rawPayload);
      if (!parsed.success) {
        const response: JoinResponse = { ok: false, reason: "room_not_found" };
        socket.emit("joinResult", response);
        return;
      }
      const payload = parsed.data;
      const room = registry.get(payload.roomToken);
      if (!room) {
        const response: JoinResponse = { ok: false, reason: "room_not_found" };
        socket.emit("joinResult", response);
        return;
      }
      currentRoom = room;
      const conns = getOrCreateConnections(payload.roomToken);
      conns.sockets.set(socket.id, socket);

      let seat: Seat;
      let sessionToken: string;
      let reconnected = false;
      let previousSessionNote: "reservation_expired" | "server_restarted" | undefined;

      if (payload.sessionToken) {
        const reconnectResult = room.manager.reconnect(socket.id, payload.sessionToken);
        if (reconnectResult.ok) {
          seat = reconnectResult.seat;
          sessionToken = payload.sessionToken;
          reconnected = true;
        } else {
          const joinResult = room.manager.join(socket.id);
          if (!joinResult.ok) {
            const response: JoinResponse = { ok: false, reason: "room_full" };
            socket.emit("joinResult", response);
            return;
          }
          seat = joinResult.seat;
          sessionToken = joinResult.sessionToken;
          if (reconnectResult.reason === "reservation_expired") {
            previousSessionNote = "reservation_expired";
          } else if (reconnectResult.reason === "not_found") {
            previousSessionNote = "server_restarted";
          }
          // reason === "seat_taken" の場合は特に警告せず、新規参加として静かに処理する
          // (同じブラウザの別タブなどでセッショントークンが偶然重複したケースを想定)
        }
      } else {
        const joinResult = room.manager.join(socket.id);
        if (!joinResult.ok) {
          const response: JoinResponse = { ok: false, reason: "room_full" };
          socket.emit("joinResult", response);
          return;
        }
        seat = joinResult.seat;
        sessionToken = joinResult.sessionToken;
      }

      mySeat = seat;

      const response: JoinResponse = {
        ok: true,
        seat,
        sessionToken,
        reconnected,
        previousSessionNote,
        view: room.getView(seatToPerspective(seat)),
        lobbyPhase: room.lobbyPhase,
      };
      socket.emit("joinResult", response);

      if (reconnected) {
        for (const pending of conns.pendingRequests.values()) {
          if (pending.forSeat === seat) {
            socket.emit(pending.event, pending.payload);
          }
        }
      }

      broadcast(payload.roomToken, room, conns);
    });

    socket.on("submitErroroidChoice", (rawPayload) => {
      const parsed = submitErroroidChoiceRequestSchema.safeParse(rawPayload);
      if (!parsed.success) {
        const response: SubmitErroroidChoiceResult = { ok: false, error: "invalid payload" };
        socket.emit("submitErroroidChoiceResult", response);
        return;
      }
      const payload = parsed.data;
      if (!currentRoom || !mySeat) {
        const response: SubmitErroroidChoiceResult = { ok: false, error: "not joined" };
        socket.emit("submitErroroidChoiceResult", response);
        return;
      }
      if (mySeat !== "player1" && mySeat !== "player2") {
        const response: SubmitErroroidChoiceResult = { ok: false, error: "spectators cannot submit" };
        socket.emit("submitErroroidChoiceResult", response);
        return;
      }
      const result = currentRoom.submitErroroidChoice(mySeat, payload.character);
      socket.emit("submitErroroidChoiceResult", result);
      const conns = getOrCreateConnections(currentRoom.token);
      broadcast(currentRoom.token, currentRoom, conns);
    });

    socket.on("action", (rawPayload) => {
      void (async () => {
        const parsed = actionRequestSchema.safeParse(rawPayload);
        if (!parsed.success) {
          const response: ActionResultPayload = { ok: false, error: "invalid payload" };
          socket.emit("actionResult", response);
          return;
        }
        const payload = parsed.data;
        if (!currentRoom || !mySeat) {
          const response: ActionResultPayload = { ok: false, error: "not joined" };
          socket.emit("actionResult", response);
          return;
        }
        if (mySeat !== "player1" && mySeat !== "player2") {
          // 観戦者からの操作は拒否
          const response: ActionResultPayload = { ok: false, error: "spectators cannot act" };
          socket.emit("actionResult", response);
          return;
        }
        if (payload.action.player !== mySeat) {
          const response: ActionResultPayload = { ok: false, error: "cannot act as another player" };
          socket.emit("actionResult", response);
          return;
        }
        const room = currentRoom;
        const conns = getOrCreateConnections(room.token);
        const chooser = new SocketEffectChooser(room, conns);
        try {
          const result = await room.dispatch(payload.action, chooser);
          const response: ActionResultPayload = { ok: !result.error, error: result.error, log: result.log };
          socket.emit("actionResult", response);
          broadcast(room.token, room, conns, result.log, socket.id);
        } catch (error) {
          const response: ActionResultPayload = { ok: false, error: (error as Error).message };
          socket.emit("actionResult", response);
        }
      })();
    });

    socket.on("chooseTargetsResponse", (rawPayload) => {
      const parsed = chooseTargetsResponseSchema.safeParse(rawPayload);
      if (!parsed.success || !currentRoom) return;
      const payload = parsed.data;
      const conns = getOrCreateConnections(currentRoom.token);
      const pending = conns.pendingRequests.get(payload.requestId);
      if (pending) {
        conns.pendingRequests.delete(payload.requestId);
        pending.resolve(payload.chosen as never);
      }
    });

    socket.on("chooseDiscardResponse", (rawPayload) => {
      const parsed = chooseDiscardResponseSchema.safeParse(rawPayload);
      if (!parsed.success || !currentRoom) return;
      const payload = parsed.data;
      const conns = getOrCreateConnections(currentRoom.token);
      const pending = conns.pendingRequests.get(payload.requestId);
      if (pending) {
        conns.pendingRequests.delete(payload.requestId);
        pending.resolve(payload.picked as never);
      }
    });

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      currentRoom.manager.disconnect(socket.id);
      const conns = getOrCreateConnections(currentRoom.token);
      conns.sockets.delete(socket.id);
      broadcast(currentRoom.token, currentRoom, conns);
    });
  });
}
