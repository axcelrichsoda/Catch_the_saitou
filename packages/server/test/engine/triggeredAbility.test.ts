import type { EffectStep } from "@erroroid/shared";
import { DEDUCTION_CARD_DEFS } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { addEvidence, findSlot } from "../../src/game/Board.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { decideOliverTrigger } from "../../src/game/TriggeredAbility.js";
import { makeState, ScriptedChooser } from "../effects/testHelpers.js";

describe("decideOliverTrigger (単体)", () => {
  it("オリバー以外のキャラでは発動しない", () => {
    const state = makeState("charlotte", "ben");
    expect(decideOliverTrigger(state, "player2", "lucas", 3, "player1").fires).toBe(false);
  });

  it("現在の証拠が4でなければ発動しない(このstateのoliverは初期値0)", () => {
    const state = makeState("charlotte", "ben");
    expect(decideOliverTrigger(state, "player2", "oliver", 3, "player1").fires).toBe(false);
  });

  it("変化前後とも4(変化なし)の場合は発動しない", () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "oliver", 4) } };
    expect(decideOliverTrigger(state, "player2", "oliver", 4, "player1").fires).toBe(false);
  });

  it("自分のターン中(mutatedOwner === actingPlayer)は発動しない", () => {
    const state = makeState("charlotte", "ben");
    expect(decideOliverTrigger(state, "player1", "oliver", 3, "player1").fires).toBe(false);
  });
});

describe("EffectResolver: オリバーの常在トリガー(相手ターン中に証拠が丁度4になった瞬間)", () => {
  it("犯人でなければオリバーがオープンされ、相手(オリバーの持ち主から見た相手)の全アンドロイドの証拠が+1される", async () => {
    let state = makeState("charlotte", "ben"); // player2の犯人はben(oliverはANDROID)
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "oliver", 2) } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "oliver" }]]);

    // player1が「追跡」でplayer2のoliverを狙う(2 + 2 = 4)
    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.tracking.effect, "player1", chooser);

    expect(result.gameOver).toBeUndefined();
    const oliverSlot = findSlot(result.state.player2.board, "oliver");
    expect(oliverSlot.isOpen).toBe(true);
    expect(oliverSlot.evidence).toBe(4); // オリバー自身の場(player2)は+1の対象外のため変化なし

    // オリバーの持ち主(player2)から見た相手(player1)の全アンドロイドが+1される
    expect(findSlot(result.state.player1.board, "charlotte").evidence).toBe(1);
    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(0); // オリバーの持ち主自身の場は対象外
  });

  it("オリバーが犯人だった場合は即座にゲーム終了し、全体+1は適用されない", async () => {
    let state = makeState("charlotte", "oliver"); // player2の犯人はoliver
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "oliver", 2) } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "oliver" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.tracking.effect, "player1", chooser);

    expect(result.gameOver).toEqual({ loser: "player2", character: "oliver" });
    // ゲーム終了により全体+1は適用されない
    expect(findSlot(result.state.player1.board, "charlotte").evidence).toBe(0);
  });

  it("自分のターン中に自分のオリバーの証拠が4になっても発動しない", async () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player1: { ...state.player1, board: addEvidence(state.player1.board, "oliver", 3) } };
    const script: EffectStep[] = [
      { kind: "selectTarget", chooser: "self", board: "ownerSelf", count: 1, bindAs: "t" },
      { kind: "addEvidence", target: "t", amount: 1 },
    ];
    const chooser = new ScriptedChooser([[{ owner: "player1", character: "oliver" }]]);

    const result = await resolveEffect(state, script, "player1", chooser);

    const oliverSlot = findSlot(result.state.player1.board, "oliver");
    expect(oliverSlot.evidence).toBe(4);
    expect(oliverSlot.isOpen).toBe(false); // 自分のターンなので常在トリガーは不発動
    // 全体+1も適用されていないこと(他キャラは0のまま)
    expect(findSlot(result.state.player1.board, "charlotte").evidence).toBe(0);
  });
});
