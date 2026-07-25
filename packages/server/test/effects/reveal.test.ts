import { computeRevealCost, REVEAL_CARD_DEFS } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { findSlot } from "../../src/game/Board.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { makeState, ScriptedChooser } from "./testHelpers.js";

describe("真相解明: 自分が相手のアンドロイドを1体指名してオープンする", () => {
  it("犯人を当てれば即ゲーム終了", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "ben" }]]);

    const result = await resolveEffect(state, REVEAL_CARD_DEFS.revealFirst.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "ben").isOpen).toBe(true);
    expect(result.gameOver).toEqual({ loser: "player2", character: "ben" });
  });

  it("外せばオープンされるだけでゲームは続く", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, REVEAL_CARD_DEFS.revealSecond.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").isOpen).toBe(true);
    expect(result.gameOver).toBeUndefined();
  });
});

describe("computeRevealCost: 自分の場のオープン済み枚数だけ基準値から減少", () => {
  it("先攻の基準値は13、オープン済み0枚ならそのまま13", () => {
    expect(computeRevealCost(REVEAL_CARD_DEFS.revealFirst, 0)).toBe(13);
  });

  it("後攻の基準値は12、オープン済み枚数分だけ減る", () => {
    expect(computeRevealCost(REVEAL_CARD_DEFS.revealSecond, 5)).toBe(7);
  });

  it("0未満にはならない", () => {
    expect(computeRevealCost(REVEAL_CARD_DEFS.revealSecond, 99)).toBe(0);
  });
});
