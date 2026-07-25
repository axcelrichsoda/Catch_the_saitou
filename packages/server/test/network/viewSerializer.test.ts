import { describe, expect, it } from "vitest";
import { openSlot } from "../../src/game/Board.js";
import { serializeView } from "../../src/network/ViewSerializer.js";
import { makeState } from "../effects/testHelpers.js";

describe("serializeView", () => {
  it("自分視点: 自分の手札内容・自分の未オープン正体は見える", () => {
    const state = makeState("charlotte", "ben", { player1Hand: ["tracking", "interrogation"] });

    const view = serializeView(state, "player1");

    expect(view.player1.hand).toEqual(["tracking", "interrogation"]);
    expect(view.player1.handCount).toBe(2);
    const ownCharlotte = view.player1.board.find((s) => s.character === "charlotte")!;
    expect(ownCharlotte.identity).toBe("ERROROID"); // 自分の場は未オープンでも正体が見える
  });

  it("自分視点: 相手の手札は枚数のみ、相手の未オープン正体は伏せられる", () => {
    const state = makeState("charlotte", "ben", { player2Hand: ["tracking", "interrogation", "motiveGrasp"] });

    const view = serializeView(state, "player1");

    expect(view.player2.hand).toBeUndefined();
    expect(view.player2.handCount).toBe(3);
    const opponentBen = view.player2.board.find((s) => s.character === "ben")!;
    expect(opponentBen.identity).toBeUndefined(); // 相手のERROROIDは伏せられる
    expect(opponentBen.character).toBe("ben"); // characterは常に公開(配置順が固定のため)
  });

  it("観戦者視点: 両プレイヤーの手札・未オープン正体がどちらも伏せられる", () => {
    const state = makeState("charlotte", "ben", {
      player1Hand: ["tracking"],
      player2Hand: ["motiveGrasp"],
    });

    const view = serializeView(state, "spectator");

    expect(view.player1.hand).toBeUndefined();
    expect(view.player2.hand).toBeUndefined();
    const p1Charlotte = view.player1.board.find((s) => s.character === "charlotte")!;
    const p2Ben = view.player2.board.find((s) => s.character === "ben")!;
    expect(p1Charlotte.identity).toBeUndefined();
    expect(p2Ben.identity).toBeUndefined();
  });

  it("オープン済みのカードは誰の視点からも正体が見える", () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player1: { ...state.player1, board: openSlot(state.player1.board, "charlotte") } };

    const spectatorView = serializeView(state, "spectator");
    const player2View = serializeView(state, "player2");

    expect(spectatorView.player1.board.find((s) => s.character === "charlotte")!.identity).toBe("ERROROID");
    expect(player2View.player1.board.find((s) => s.character === "charlotte")!.identity).toBe("ERROROID");
  });

  it("山札は残り枚数のみ、廃棄場は内容が誰の視点からも見える", () => {
    const state = makeState("charlotte", "ben", {
      drawPile: ["tracking", "tracking", "motiveGrasp"],
      discardPile: ["interrogation"],
    });

    const view = serializeView(state, "spectator");

    expect(view.deck.drawCount).toBe(3);
    expect(view.deck.discardPile).toEqual(["interrogation"]);
  });

  it("手番・フェーズ・勝者情報は誰の視点からも見える", () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, phase: "gameOver", winner: "player2" };

    const view = serializeView(state, "spectator");

    expect(view.turn).toBe("player1");
    expect(view.phase).toBe("gameOver");
    expect(view.winner).toBe("player2");
  });
});
