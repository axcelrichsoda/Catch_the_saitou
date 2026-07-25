import { ANDROID_CARD_EFFECTS, DEDUCTION_CARD_DEFS } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { addEvidence, findSlot } from "../../src/game/Board.js";
import { checkForceOpen } from "../../src/game/ForceOpenChecker.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { makeState, ScriptedChooser } from "../effects/testHelpers.js";

describe("checkForceOpen", () => {
  it("証拠がアリバイ未満なら何もしない", () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "lucas", 4) } };

    const outcome = checkForceOpen(state, "player2", "lucas");

    expect(outcome.opened).toBe(false);
    expect(findSlot(outcome.state.player2.board, "lucas").isOpen).toBe(false);
  });

  it("証拠がアリバイ以上ならオープンする", () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "lucas", 5) } };

    const outcome = checkForceOpen(state, "player2", "lucas");

    expect(outcome.opened).toBe(true);
    expect(outcome.identity).toBe("ANDOROID");
    expect(findSlot(outcome.state.player2.board, "lucas").isOpen).toBe(true);
  });
});

describe("EffectResolver: 効果発動中でも証拠がアリバイ以上になれば即座に強制オープンする", () => {
  it("決定的証拠(+5)で0からちょうどアリバイ値(5)に達すると自動的にオープンされる", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben、lucasは無実
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.decisiveEvidence.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(5);
    expect(findSlot(result.state.player2.board, "lucas").isOpen).toBe(true);
    expect(result.log).toContainEqual({ kind: "open", owner: "player2", character: "lucas", identity: "ANDOROID" });
    expect(result.gameOver).toBeUndefined();
  });

  it("強制オープンされた対象がERROROIDなら即座にゲーム終了する", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "ben" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.decisiveEvidence.effect, "player1", chooser);

    expect(result.gameOver).toEqual({ loser: "player2", character: "ben" });
  });

  it("saintの2回攻撃(+4+4)で累計がアリバイ以上になれば2回目の適用直後にオープンされる", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([
      [{ owner: "player2", character: "lucas" }],
      [{ owner: "player2", character: "lucas" }],
    ]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.saint.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(8);
    expect(findSlot(result.state.player2.board, "lucas").isOpen).toBe(true);
  });
});
