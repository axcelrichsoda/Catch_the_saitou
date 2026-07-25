import { describe, expect, it } from "vitest";
import { Room } from "../../src/network/Room.js";
import { ScriptedChooser } from "../effects/testHelpers.js";

describe("Room: ロビー〜対戦開始フロー", () => {
  it("プレイヤーが2人揃うまではwaitingForPlayers", () => {
    const room = new Room("token1");
    room.manager.join("s1");

    expect(room.lobbyPhase).toBe("waitingForPlayers");
  });

  it("2人揃うと犯人選択待ちになり、両者提出でゲームが始まる", () => {
    // rng()<0.5を常に返し、先攻をplayer1に固定してアサーションを決定的にする。
    const room = new Room("token1", undefined, () => 0);
    room.manager.join("s1");
    room.manager.join("s2");

    expect(room.lobbyPhase).toBe("waitingForErroroidChoices");

    const r1 = room.submitErroroidChoice("player1", "ben");
    expect(r1).toEqual({ ok: true });
    expect(room.lobbyPhase).toBe("waitingForErroroidChoices"); // まだplayer2が未提出

    const r2 = room.submitErroroidChoice("player2", "oliver");
    expect(r2).toEqual({ ok: true });
    expect(room.lobbyPhase).toBe("inGame");
    expect(room.getState()).toBeDefined();
    expect(room.getState()!.player1.revealCardId).toBe("revealFirst");
  });

  it("rngが0.5以上を返すとplayer2が先攻になる(常にplayer1固定ではない)", () => {
    const room = new Room("token1", undefined, () => 0.9);
    room.manager.join("s1");
    room.manager.join("s2");

    room.submitErroroidChoice("player1", "ben");
    room.submitErroroidChoice("player2", "oliver");

    expect(room.getState()!.player2.revealCardId).toBe("revealFirst");
    expect(room.getState()!.player1.revealCardId).toBe("revealSecond");
    expect(room.getView("player1")!.turn).toBe("player2");
  });

  it("2人揃う前の犯人選択提出はエラーになる", () => {
    const room = new Room("token1");
    room.manager.join("s1");

    const result = room.submitErroroidChoice("player1", "ben");

    expect(result).toEqual({ ok: false, error: "waiting for both players to join" });
  });

  it("ゲーム開始後の犯人選択提出はエラーになる", () => {
    const room = new Room("token1");
    room.manager.join("s1");
    room.manager.join("s2");
    room.submitErroroidChoice("player1", "ben");
    room.submitErroroidChoice("player2", "oliver");

    const result = room.submitErroroidChoice("player1", "saint");

    expect(result).toEqual({ ok: false, error: "game already started" });
  });
});

describe("Room: dispatch/getView", () => {
  it("ゲーム開始前にdispatchすると例外になる", async () => {
    const room = new Room("token1");
    await expect(
      room.dispatch({ type: "endTurn", player: "player1" }, new ScriptedChooser()),
    ).rejects.toThrow();
  });

  it("ゲーム開始後はdispatchが内部状態を更新し、getViewがそれを反映する", async () => {
    const room = new Room("token1", undefined, () => 0);
    room.manager.join("s1");
    room.manager.join("s2");
    room.submitErroroidChoice("player1", "ben");
    room.submitErroroidChoice("player2", "oliver");

    const before = room.getView("player1")!;
    expect(before.turn).toBe("player1");

    await room.dispatch({ type: "endTurn", player: "player1" }, new ScriptedChooser());

    const after = room.getView("player1")!;
    expect(after.turn).toBe("player2");
  });

  it("ゲーム開始前はgetViewがundefinedを返す", () => {
    const room = new Room("token1");
    expect(room.getView("player1")).toBeUndefined();
  });

  it("同時に発火したdispatchも発生順に直列処理され、先の変更が失われない(排他制御)", async () => {
    const room = new Room("token1", undefined, () => 0); // player1が先攻
    room.manager.join("s1");
    room.manager.join("s2");
    room.submitErroroidChoice("player1", "ben");
    room.submitErroroidChoice("player2", "oliver");

    // どちらもawaitせず、ほぼ同時に発火させる(内部で先に読み取ったgameStateを
    // 後発が上書きしてしまうバグがあると、p2側が「not your turn」で失敗する)。
    const p1 = room.dispatch({ type: "endTurn", player: "player1" }, new ScriptedChooser());
    const p2 = room.dispatch({ type: "endTurn", player: "player2" }, new ScriptedChooser());

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();
    // player1エンド→player2の番、player2エンド→再びplayer1の番に戻る。
    expect(room.getState()!.turn).toBe("player1");
  });
});
