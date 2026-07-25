import { ANDROID_CARD_EFFECTS } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { addEvidence, findSlot } from "../../src/game/Board.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { makeState, ScriptedChooser } from "./testHelpers.js";

describe("charlotte: 相手はアンドロイドを1体選択し、オープンする", () => {
  it("相手が選んだカードがANDROIDならオープンのみでゲームは続く", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben、lucasは無実
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.charlotte.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").isOpen).toBe(true);
    expect(result.gameOver).toBeUndefined();
    expect(result.aborted).toBe(false);
  });

  it("相手が選んだカードがERROROIDなら即座にゲーム終了", async () => {
    const state = makeState("charlotte", "ben"); // player2の犯人はben
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "ben" }]]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.charlotte.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "ben").isOpen).toBe(true);
    expect(result.gameOver).toEqual({ loser: "player2", character: "ben" });
  });
});

describe("lucas: 自分の場の証拠を0にし、その分を相手が選んだ相手自身の場のカードへ移す", () => {
  it("除去した証拠量が正しく移動する", async () => {
    let state = makeState("charlotte", "ben");
    state = {
      ...state,
      player1: { ...state.player1, board: addEvidence(state.player1.board, "saint", 3) },
    };
    const chooser = new ScriptedChooser([
      [{ owner: "player1", character: "saint" }], // 自分(player1)が選ぶ: 自分の場から証拠を0にする対象
      [{ owner: "player2", character: "ben" }], // 相手(player2)が選ぶ: 相手自身の場から移動先
    ]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.lucas.effect, "player1", chooser);

    expect(findSlot(result.state.player1.board, "saint").evidence).toBe(0);
    expect(findSlot(result.state.player2.board, "ben").evidence).toBe(3);
  });
});

describe("ivy: 相手の場のアンドロイドに証拠+1を3回繰り返す", () => {
  it("同じ対象を3回選べば証拠+3になる", async () => {
    const state = makeState("ben", "charlotte"); // player1の犯人はben
    const chooser = new ScriptedChooser([
      [{ owner: "player2", character: "charlotte" }],
      [{ owner: "player2", character: "charlotte" }],
      [{ owner: "player2", character: "charlotte" }],
    ]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.ivy.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "charlotte").evidence).toBe(3);
  });
});

describe("ben: 相手の証拠2以上のアンドロイドの中にエラーロイドがいるか答える", () => {
  it("証拠2以上のカードの中に犯人がいればtrue", async () => {
    let state = makeState("charlotte", "oliver"); // player2の犯人はoliver
    state = {
      ...state,
      player2: { ...state.player2, board: addEvidence(state.player2.board, "oliver", 2) },
    };

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.ben.effect, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(false);
    expect(result.log).toEqual([{ kind: "truthAnswer", question: "existsInFilteredSet", answer: true, boardOwner: "player2" }]);
  });

  it("証拠2以上のカードが1枚も無ければ不発動(abort)", async () => {
    const state = makeState("charlotte", "oliver");

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.ben.effect, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(true);
    expect(result.log).toEqual([]);
  });
});

describe("lillian: 消費エリアの推理力を手札の枚数だけメモリーエリアに戻す", () => {
  it("手札枚数が消費エリアより少ない場合はその枚数分だけ戻す", async () => {
    let state = makeState("charlotte", "ben", { player1Hand: ["tracking", "tracking", "tracking"] });
    state = { ...state, player1: { ...state.player1, tokens: { memory: 2, consumption: 5 } } };

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.lillian.effect, "player1", new ScriptedChooser());

    expect(result.state.player1.tokens).toEqual({ memory: 5, consumption: 2 });
  });
});

describe("oliver: 自分のターン中の自発オープンでは効果不発動(空スクリプト)", () => {
  it("状態を一切変更しない", async () => {
    const state = makeState("charlotte", "ben");

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.oliver.effect, "player1", new ScriptedChooser());

    expect(result.state).toEqual(state);
    expect(result.log).toEqual([]);
    expect(result.gameOver).toBeUndefined();
  });
});

describe("saint: 相手のアンドロイドに証拠+4を2回繰り返す", () => {
  it("2回とも同じ対象なら証拠+8になる", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([
      [{ owner: "player2", character: "lucas" }],
      [{ owner: "player2", character: "lucas" }],
    ]);

    const result = await resolveEffect(state, ANDROID_CARD_EFFECTS.saint.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(8);
  });
});
