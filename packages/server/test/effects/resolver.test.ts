import type { EffectStep } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { findSlot, openSlot } from "../../src/game/Board.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { makeState, ScriptedChooser } from "./testHelpers.js";

describe("EffectResolver: 対象不正の検証", () => {
  it("chooserが候補外のターゲットを返すと例外を投げる", async () => {
    const state = makeState("charlotte", "ben");
    const script: EffectStep[] = [
      { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "t" },
      { kind: "addEvidence", target: "t", amount: 1 },
    ];
    const chooser = new ScriptedChooser([[{ owner: "player1", character: "charlotte" }]]); // 相手の場のはずが自分の場を返す

    await expect(resolveEffect(state, script, "player1", chooser)).rejects.toThrow();
  });

  it("候補数が要求数に満たない場合は例外を投げず不発動(abort)にする", async () => {
    let state = makeState("charlotte", "ben");
    for (const c of ["charlotte", "lucas", "ivy", "ben", "lillian", "oliver", "saint"] as const) {
      state = { ...state, player2: { ...state.player2, board: openSlot(state.player2.board, c) } };
    }
    const script: EffectStep[] = [
      { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "t" },
      { kind: "addEvidence", target: "t", amount: 1 },
    ];

    const result = await resolveEffect(state, script, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(true);
  });
});

describe("EffectResolver: ERROROIDのforceOpenは即座に効果解決を打ち切る", () => {
  it("repeat中でも1回目でERROROIDが開けば2回目は実行されない", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben
    const script: EffectStep[] = [
      {
        kind: "repeat",
        times: 2,
        steps: [
          { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "t" },
          { kind: "forceOpen", target: "t" },
          { kind: "addEvidence", target: "t", amount: 99 }, // gameOver後は実行されないはず
        ],
      },
    ];
    // 1回目でben(犯人)を選ぶ。2回目のselectTargetが呼ばれれば「候補が尽きた」等の想定外の挙動になる
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "ben" }]]);

    const result = await resolveEffect(state, script, "player1", chooser);

    expect(result.gameOver).toEqual({ loser: "player2", character: "ben" });
    // ERROROIDオープン直後に打ち切られるため、addEvidence(+99)は実行されない
    expect(findSlot(result.state.player2.board, "ben").evidence).toBe(0);
  });
});

describe("EffectResolver: 未知のcustomハンドラは例外を投げる", () => {
  it("存在しないhandlerIdを指定すると例外", async () => {
    const state = makeState("charlotte", "ben");
    const script: EffectStep[] = [{ kind: "custom", handlerId: "does_not_exist" }];

    await expect(resolveEffect(state, script, "player1", new ScriptedChooser())).rejects.toThrow();
  });
});
