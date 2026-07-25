import { describe, expect, it } from "vitest";
import { registerSocketHandlers } from "../../src/network/SocketHandlers.js";
import { RoomRegistry } from "../../src/network/RoomRegistry.js";
import { FakeIO } from "./fakeSocket.js";

function setupIo() {
  // rng()<0.5固定でplayer1を先攻にし、以降のテスト内アクション列(player1から開始)を決定的にする。
  const registry = new RoomRegistry(() => 0);
  const io = new FakeIO();
  registerSocketHandlers(io, registry);
  return { registry, io };
}

async function joinAndStartGame(io: FakeIO, roomToken: string) {
  const p1 = io.connect();
  const p1Join = p1.once<any>("joinResult");
  p1.emit("join", { roomToken });
  const p1JoinResult = await p1Join;

  const p2 = io.connect();
  const p2Join = p2.once<any>("joinResult");
  p2.emit("join", { roomToken });
  const p2JoinResult = await p2Join;

  const p1Started = p1.once<any>("view");
  const p2Started = p2.once<any>("view");
  p1.emit("submitErroroidChoice", { character: "ben" }); // player1の犯人=ben
  p2.emit("submitErroroidChoice", { character: "oliver" }); // player2の犯人=oliver
  await p1Started;
  await p2Started;

  return {
    p1,
    p2,
    p1SessionToken: p1JoinResult.sessionToken as string,
    p2SessionToken: p2JoinResult.sessionToken as string,
  };
}

describe("SocketHandlers: 参加・座席割り当て", () => {
  it("2人が参加し犯人を提出するとゲームが開始し、各自のviewが届く", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();

    const { p1, p2 } = await joinAndStartGame(io, room.token);

    const p1ViewPromise = p1.once<any>("view");
    const p2ViewPromise = p2.once<any>("view");
    // 何か1つ変化を起こして最新のviewを取得する(endTurnで手番を渡す)
    p1.emit("action", { action: { type: "endTurn", player: "player1" } });
    const p1View = await p1ViewPromise;
    const p2View = await p2ViewPromise;

    expect(p1View.perspective).toBe("player1");
    expect(p2View.perspective).toBe("player2");
    expect(p1View.phase).toBe("thinking");
  });

  it("5人目の接続はroom_fullで拒否される", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();

    for (let i = 0; i < 4; i++) {
      const c = io.connect();
      const joinPromise = c.once<any>("joinResult");
      c.emit("join", { roomToken: room.token });
      await joinPromise;
    }

    const fifth = io.connect();
    const joinPromise = fifth.once<any>("joinResult");
    fifth.emit("join", { roomToken: room.token });
    const result = await joinPromise;

    expect(result).toEqual({ ok: false, reason: "room_full" });
  });

  it("存在しないルームトークンはroom_not_foundになる", async () => {
    const { io } = setupIo();
    const c = io.connect();
    const joinPromise = c.once<any>("joinResult");
    c.emit("join", { roomToken: "does-not-exist" });
    const result = await joinPromise;

    expect(result).toEqual({ ok: false, reason: "room_not_found" });
  });
});

describe("SocketHandlers: 観戦者", () => {
  it("観戦者視点では両者の手札・未オープン正体が伏せられる", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();
    await joinAndStartGame(io, room.token);

    const spectator = io.connect();
    const joinPromise = spectator.once<any>("joinResult");
    spectator.emit("join", { roomToken: room.token });
    const joinResult = await joinPromise;

    expect(joinResult.seat).toBe("spectator1");
    expect(joinResult.view.player1.hand).toBeUndefined();
    expect(joinResult.view.player2.hand).toBeUndefined();
    const p2Oliver = joinResult.view.player2.board.find((s: any) => s.character === "oliver");
    expect(p2Oliver.identity).toBeUndefined();
  });

  it("観戦者からのactionは拒否される", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();
    await joinAndStartGame(io, room.token);

    const spectator = io.connect();
    const joinPromise = spectator.once<any>("joinResult");
    spectator.emit("join", { roomToken: room.token });
    await joinPromise;

    const resultPromise = spectator.once<any>("actionResult");
    spectator.emit("action", { action: { type: "endTurn", player: "player1" } });
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("spectators cannot act");
  });
});

describe("SocketHandlers: 対象選択が必要なアクションの往復", () => {
  it("openAndroidで相手に対象選択を依頼し、応答後に盤面へ反映される", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();
    const { p1, p2 } = await joinAndStartGame(io, room.token);

    // player1のメモリーを3まで貯める(charlotteのコスト3)。endTurnを4回(p1,p2,p1,p2)。
    for (const [sock, player] of [
      [p1, "player1"],
      [p2, "player2"],
      [p1, "player1"],
      [p2, "player2"],
    ] as const) {
      const ack = p1.once<any>("view");
      sock.emit("action", { action: { type: "endTurn", player } });
      await ack;
    }

    const chooseRequestPromise = p2.once<any>("chooseTargetsRequest");
    const actionResultPromise = p1.once<any>("actionResult");
    p1.emit("action", { action: { type: "openAndroid", player: "player1", character: "charlotte" } });

    const chooseRequest = await chooseRequestPromise;
    expect(chooseRequest.candidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ owner: "player2" })]),
    );

    const p1ViewPromise = p1.once<any>("view");
    p2.emit("chooseTargetsResponse", {
      requestId: chooseRequest.requestId,
      chosen: [{ owner: "player2", character: "lucas" }],
    });

    const actionResult = await actionResultPromise;
    expect(actionResult.ok).toBe(true);

    const p1View = await p1ViewPromise;
    const lucasSlot = p1View.player2.board.find((s: any) => s.character === "lucas");
    expect(lucasSlot.isOpen).toBe(true);
  });
});

describe("SocketHandlers: 操作ログの共有", () => {
  it("ある操作で生じたログは、操作した本人以外にもlogEntriesとして配信される", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();
    const { p1, p2 } = await joinAndStartGame(io, room.token);

    for (const [sock, player] of [
      [p1, "player1"],
      [p2, "player2"],
      [p1, "player1"],
      [p2, "player2"],
    ] as const) {
      const ack = p1.once<any>("view");
      sock.emit("action", { action: { type: "endTurn", player } });
      await ack;
    }

    const chooseRequestPromise = p2.once<any>("chooseTargetsRequest");
    const p2LogPromise = p2.once<any>("logEntries");
    p1.emit("action", { action: { type: "openAndroid", player: "player1", character: "charlotte" } });

    const chooseRequest = await chooseRequestPromise;
    p2.emit("chooseTargetsResponse", {
      requestId: chooseRequest.requestId,
      chosen: [{ owner: "player2", character: "lucas" }],
    });

    const p2Log = await p2LogPromise;
    expect(p2Log).toContainEqual({ kind: "open", owner: "player2", character: "lucas", identity: "ANDOROID" });
  });
});

describe("SocketHandlers: 切断・再接続", () => {
  it("切断後にセッショントークンで再接続すると同じ座席へ戻る", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();

    const p1 = io.connect();
    const joinPromise = p1.once<any>("joinResult");
    p1.emit("join", { roomToken: room.token });
    const joinResult = await joinPromise;

    p1.simulateDisconnect();

    const p1New = io.connect();
    const reconnectPromise = p1New.once<any>("joinResult");
    p1New.emit("join", { roomToken: room.token, sessionToken: joinResult.sessionToken });
    const reconnectResult = await reconnectPromise;

    expect(reconnectResult.ok).toBe(true);
    expect(reconnectResult.seat).toBe("player1");
    expect(reconnectResult.reconnected).toBe(true);
  });

  it("対象選択待ち中に切断しても、再接続後に同じ依頼が再送される", async () => {
    const { registry, io } = setupIo();
    const room = registry.createRoom();
    const { p1, p2, p2SessionToken } = await joinAndStartGame(io, room.token);

    for (const [sock, player] of [
      [p1, "player1"],
      [p2, "player2"],
      [p1, "player1"],
      [p2, "player2"],
    ] as const) {
      const ack = p1.once<any>("view");
      sock.emit("action", { action: { type: "endTurn", player } });
      await ack;
    }

    const chooseRequestPromise = p2.once<any>("chooseTargetsRequest");
    p1.emit("action", { action: { type: "openAndroid", player: "player1", character: "charlotte" } });
    const originalRequest = await chooseRequestPromise;

    // player2がこの時点(まだ応答していない)で切断
    p2.simulateDisconnect();
    expect(room.manager.socketIdFor("player2")).toBeUndefined();

    // 新しいソケットでセッショントークンを使って再接続すると、
    // 保留中だった同じchooseTargetsRequestが再送される
    const p2New = io.connect();
    const resentRequestPromise = p2New.once<any>("chooseTargetsRequest");
    const rejoinPromise = p2New.once<any>("joinResult");
    p2New.emit("join", { roomToken: room.token, sessionToken: p2SessionToken });
    const rejoinResult = await rejoinPromise;
    const resentRequest = await resentRequestPromise;

    expect(rejoinResult.seat).toBe("player2");
    expect(resentRequest.requestId).toBe(originalRequest.requestId);
    expect(resentRequest.candidates).toEqual(originalRequest.candidates);

    // 新しいソケットから応答すれば、保留中だったopenAndroidアクションが正しく完了する
    const p1ViewPromise = p1.once<any>("view");
    p2New.emit("chooseTargetsResponse", {
      requestId: resentRequest.requestId,
      chosen: [{ owner: "player2", character: "lucas" }],
    });
    const p1View = await p1ViewPromise;
    const lucasSlot = p1View.player2.board.find((s: any) => s.character === "lucas");
    expect(lucasSlot.isOpen).toBe(true);
  });
});
