import { describe, expect, it } from "vitest";
import { RoomManager } from "../../src/network/RoomManager.js";

function makeClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("RoomManager: 座席割り当て", () => {
  it("接続順にplayer1→player2→spectator1→spectator2の順で割り当てる", () => {
    const room = new RoomManager();

    expect(room.join("s1")).toMatchObject({ ok: true, seat: "player1" });
    expect(room.join("s2")).toMatchObject({ ok: true, seat: "player2" });
    expect(room.join("s3")).toMatchObject({ ok: true, seat: "spectator1" });
    expect(room.join("s4")).toMatchObject({ ok: true, seat: "spectator2" });
  });

  it("5人目以降は拒否される", () => {
    const room = new RoomManager();
    room.join("s1");
    room.join("s2");
    room.join("s3");
    room.join("s4");

    const result = room.join("s5");

    expect(result).toEqual({ ok: false, reason: "room_full" });
  });

  it("join成功時は毎回異なるセッショントークンが発行される", () => {
    const room = new RoomManager();
    const r1 = room.join("s1");
    const r2 = room.join("s2");

    expect(r1.ok && r2.ok && r1.sessionToken !== r2.sessionToken).toBe(true);
  });

  it("同一ソケットからの重複joinは新しい座席を消費せず同じ座席を返す(React StrictModeの二重effect実行対策)", () => {
    const room = new RoomManager();
    const first = room.join("s1");
    const second = room.join("s1");

    expect(second).toEqual(first);
    expect(room.playerCount()).toBe(1);

    const other = room.join("s2");
    expect(other).toMatchObject({ ok: true, seat: "player2" });
  });
});

describe("RoomManager: 観戦者の切断は即座に座席解放", () => {
  it("観戦者が切断すると次の接続者がその枠を再利用できる", () => {
    const room = new RoomManager();
    room.join("s1"); // player1
    room.join("s2"); // player2
    room.join("s3"); // spectator1

    room.disconnect("s3");
    const result = room.join("s4");

    expect(result).toEqual(expect.objectContaining({ ok: true, seat: "spectator1" }));
  });
});

describe("RoomManager: プレイヤーの切断・再接続", () => {
  it("切断後もセッショントークンがあれば同じ座席に戻れる", () => {
    const room = new RoomManager();
    const joinResult = room.join("s1");
    if (!joinResult.ok) throw new Error("unexpected");

    room.disconnect("s1");
    const reconnectResult = room.reconnect("s1-new", joinResult.sessionToken);

    expect(reconnectResult).toEqual({ ok: true, seat: "player1" });
    expect(room.seatFor("s1-new")).toBe("player1");
  });

  it("予約保持時間内は他人が同じ座席を奪えない", () => {
    const clock = makeClock();
    const room = new RoomManager({ now: clock.now, seatReservationMs: 5 * 60 * 1000 });
    room.join("s1"); // player1
    room.disconnect("s1");
    clock.advance(60 * 1000); // 1分後、まだ予約保持期間内

    const result = room.join("s2");

    expect(result).toMatchObject({ ok: true, seat: "player2" }); // player1は奪えずplayer2に割り当てられる
  });

  it("接続がまだ生きているセッショントークンで別ソケットが再接続しようとするとseat_takenになり座席を奪えない(同一ブラウザの別タブでトークンが重複した場合の保護)", () => {
    const room = new RoomManager();
    const joinResult = room.join("s1"); // player1、s1は切断していない
    if (!joinResult.ok) throw new Error("unexpected");

    const result = room.reconnect("s2", joinResult.sessionToken);

    expect(result).toEqual({ ok: false, reason: "seat_taken" });
    expect(room.seatFor("s1")).toBe("player1"); // 元の接続が奪われていない
    expect(room.seatFor("s2")).toBeUndefined();
  });

  it("同じソケットからの再接続(冪等な呼び出し)は成功する", () => {
    const room = new RoomManager();
    const joinResult = room.join("s1");
    if (!joinResult.ok) throw new Error("unexpected");

    const result = room.reconnect("s1", joinResult.sessionToken);

    expect(result).toEqual({ ok: true, seat: "player1" });
  });

  it("誤ったセッショントークンではnot_foundになる", () => {
    const room = new RoomManager();
    room.join("s1");
    room.disconnect("s1");

    const result = room.reconnect("s1-new", "totally-wrong-token");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("予約保持時間を過ぎるとreservation_expiredになり、座席は新規参加者に解放される", () => {
    const clock = makeClock();
    const room = new RoomManager({ now: clock.now, seatReservationMs: 5 * 60 * 1000 });
    const joinResult = room.join("s1");
    if (!joinResult.ok) throw new Error("unexpected");
    room.disconnect("s1");

    clock.advance(6 * 60 * 1000); // 予約保持時間(5分)を超過

    const reconnectResult = room.reconnect("s1-new", joinResult.sessionToken);
    expect(reconnectResult).toEqual({ ok: false, reason: "reservation_expired" });

    // 座席自体は解放され、新規参加者がplayer1として入れる
    const newJoin = room.join("s2");
    expect(newJoin).toMatchObject({ ok: true, seat: "player1" });
  });

  it("tombstone保持期間も過ぎると本当に見つからない(not_found)扱いになる", () => {
    const clock = makeClock();
    const room = new RoomManager({
      now: clock.now,
      seatReservationMs: 5 * 60 * 1000,
      tombstoneRetentionMs: 60 * 60 * 1000,
    });
    const joinResult = room.join("s1");
    if (!joinResult.ok) throw new Error("unexpected");
    room.disconnect("s1");

    clock.advance(6 * 60 * 1000); // reservation切れ→tombstone化
    const midResult = room.reconnect("probe", joinResult.sessionToken); // sweepを走らせてtombstone化を確定させる
    expect(midResult).toEqual({ ok: false, reason: "reservation_expired" });

    clock.advance(61 * 60 * 1000); // tombstone保持期間も超過

    const result = room.reconnect("s1-new", joinResult.sessionToken);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("RoomManager: playerCount", () => {
  it("切断中でも予約保持期間内のプレイヤーはカウントに含む", () => {
    const room = new RoomManager();
    room.join("s1");
    room.join("s2");
    room.disconnect("s1");

    expect(room.playerCount()).toBe(2);
  });

  it("観戦者はカウントしない", () => {
    const room = new RoomManager();
    room.join("s1");
    room.join("s2");
    room.join("s3"); // spectator1

    expect(room.playerCount()).toBe(2);
  });
});
