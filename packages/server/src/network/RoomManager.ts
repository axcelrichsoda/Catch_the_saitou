import { randomUUID } from "node:crypto";
import { seatToPerspective, type Seat } from "@erroroid/shared";

export type { Seat } from "@erroroid/shared";
export { seatToPerspective };

export type JoinResult =
  | { readonly ok: true; readonly seat: Seat; readonly sessionToken: string }
  | { readonly ok: false; readonly reason: "room_full" };

export type ReconnectFailureReason = "reservation_expired" | "not_found" | "seat_taken";

export type ReconnectResult =
  | { readonly ok: true; readonly seat: Seat }
  | { readonly ok: false; readonly reason: ReconnectFailureReason };

interface SeatRecord {
  sessionToken: string;
  /** nullなら現在切断中(予約保持期間内)。 */
  socketId: string | null;
  disconnectedAt: number | null;
}

interface TombstoneRecord {
  expiredAt: number;
}

export interface RoomManagerOptions {
  readonly now?: () => number;
  /** プレイヤー座席の予約保持時間(ms)。既定5分。 */
  readonly seatReservationMs?: number;
  /** 予約期限切れをtombstoneとして残す期間(ms)。既定1時間。 */
  readonly tombstoneRetentionMs?: number;
}

const SEAT_ORDER: readonly Seat[] = ["player1", "player2", "spectator1", "spectator2"];

function isPlayerSeat(seat: Seat): boolean {
  return seat === "player1" || seat === "player2";
}

/**
 * 1ルームぶんの座席(player1/player2/spectator1/spectator2)管理。
 * - 観戦者切断は即座に座席解放(再接続の概念なし)
 * - プレイヤー切断は一定時間(seatReservationMs)座席を予約保持し、他人に奪われないようにする
 * - 予約期限切れ後もしばらく(tombstoneRetentionMs)tombstoneとして記録し、
 *   「予約期限切れ」(本人が遅れて戻ってきたケース)と「該当セッションが一切見つからない」
 *   (サーバープロセス再起動でメモリが全損したケース)を区別できるようにする
 */
export class RoomManager {
  private readonly seats = new Map<Seat, SeatRecord>();
  private readonly tombstones = new Map<string, TombstoneRecord>();
  private readonly now: () => number;
  private readonly seatReservationMs: number;
  private readonly tombstoneRetentionMs: number;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.seatReservationMs = options.seatReservationMs ?? 5 * 60 * 1000;
    this.tombstoneRetentionMs = options.tombstoneRetentionMs ?? 60 * 60 * 1000;
  }

  private sweep(): void {
    const nowMs = this.now();
    for (const [seat, record] of this.seats) {
      if (record.socketId === null && record.disconnectedAt !== null) {
        if (nowMs - record.disconnectedAt >= this.seatReservationMs) {
          this.tombstones.set(record.sessionToken, { expiredAt: nowMs });
          this.seats.delete(seat);
        }
      }
    }
    for (const [token, tomb] of this.tombstones) {
      if (nowMs - tomb.expiredAt >= this.tombstoneRetentionMs) {
        this.tombstones.delete(token);
      }
    }
  }

  join(socketId: string): JoinResult {
    this.sweep();
    // 同一ソケットからの重複join(React StrictModeの二重effect実行等)では、
    // 新しい座席を消費せず既存の座席をそのまま返す(冪等)。
    const existingSeat = this.seatFor(socketId);
    if (existingSeat) {
      const record = this.seats.get(existingSeat)!;
      return { ok: true, seat: existingSeat, sessionToken: record.sessionToken };
    }
    for (const seat of SEAT_ORDER) {
      if (!this.seats.has(seat)) {
        const sessionToken = randomUUID();
        this.seats.set(seat, { sessionToken, socketId, disconnectedAt: null });
        return { ok: true, seat, sessionToken };
      }
    }
    return { ok: false, reason: "room_full" };
  }

  reconnect(socketId: string, sessionToken: string): ReconnectResult {
    this.sweep();
    for (const record of this.seats.values()) {
      if (record.sessionToken === sessionToken) {
        if (record.socketId !== null && record.socketId !== socketId) {
          // 同じセッショントークンが既に別の生きた接続で使われている
          // (例: 同じブラウザで開いた別タブがlocalStorage/sessionStorageを誤って共有した場合)。
          // 既存の接続を横取りしてしまわないよう、再接続としては拒否する。
          return { ok: false, reason: "seat_taken" };
        }
        record.socketId = socketId;
        record.disconnectedAt = null;
        const seat = this.seatOf(record);
        return { ok: true, seat: seat! };
      }
    }
    if (this.tombstones.has(sessionToken)) {
      return { ok: false, reason: "reservation_expired" };
    }
    return { ok: false, reason: "not_found" };
  }

  private seatOf(record: SeatRecord): Seat | undefined {
    for (const [seat, r] of this.seats) {
      if (r === record) return seat;
    }
    return undefined;
  }

  disconnect(socketId: string): void {
    for (const [seat, record] of this.seats) {
      if (record.socketId === socketId) {
        if (isPlayerSeat(seat)) {
          record.socketId = null;
          record.disconnectedAt = this.now();
        } else {
          this.seats.delete(seat);
        }
        return;
      }
    }
  }

  seatFor(socketId: string): Seat | undefined {
    for (const [seat, record] of this.seats) {
      if (record.socketId === socketId) return seat;
    }
    return undefined;
  }

  /** そのプレイヤー座席へ現在割り当てられているsocketId(切断中ならundefined)。 */
  socketIdFor(seat: Seat): string | undefined {
    return this.seats.get(seat)?.socketId ?? undefined;
  }

  playerCount(): number {
    return (["player1", "player2"] as const).filter((s) => this.seats.has(s)).length;
  }
}
