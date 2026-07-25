import { DEDUCTION_CARD_DEFS } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { addEvidence, findSlot, openSlot } from "../../src/game/Board.js";
import { resolveEffect } from "../../src/game/EffectResolver.js";
import { makeState, ScriptedChooser } from "./testHelpers.js";

describe("追跡: 相手のアンドロイドに証拠+2", () => {
  it("選んだ対象の証拠が+2される", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.tracking.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(2);
  });
});

describe("単独不審: 証拠が既にあれば+4、無ければ+2", () => {
  it("証拠0の対象を選ぶと+2", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.suspiciousBehavior.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(2);
  });

  it("証拠1以上の対象を選ぶと+4", async () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "lucas", 1) } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.suspiciousBehavior.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(5); // 1 + 4
  });
});

describe("集団ヒステリー: 自分が3体選び、相手がその中から2体選んで証拠+2", () => {
  it("選ばれた2体だけ証拠+2される(3体目は変化なし)", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([
      [
        { owner: "player2", character: "charlotte" },
        { owner: "player2", character: "lucas" },
        { owner: "player2", character: "ivy" },
      ],
      [
        { owner: "player2", character: "charlotte" },
        { owner: "player2", character: "ivy" },
      ],
    ]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.mobHysteria.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "charlotte").evidence).toBe(2);
    expect(findSlot(result.state.player2.board, "ivy").evidence).toBe(2);
    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(0);
  });

  it("相手の場に未オープンが3体未満なら不発動(abort)", async () => {
    let state = makeState("charlotte", "ben");
    for (const c of ["charlotte", "lucas", "ivy", "ben", "lillian"] as const) {
      state = { ...state, player2: { ...state.player2, board: openSlot(state.player2.board, c) } };
    }
    // 残る未オープンは oliver, saint の2体のみ

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.mobHysteria.effect, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(true);
  });
});

describe("決定的証拠: 相手のアンドロイドに証拠+5", () => {
  it("選んだ対象の証拠が+5される", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.decisiveEvidence.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(5);
  });
});

describe("尋問: 証拠1以上の相手のアンドロイドを1体選び、犯人か答える", () => {
  it("選ばれた対象が犯人ならtrue", async () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player2: { ...state.player2, board: addEvidence(state.player2.board, "ben", 1) } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "ben" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.interrogation.effect, "player1", chooser);

    expect(result.log).toEqual([
      { kind: "truthAnswer", question: "isTargetErroroid", answer: true, targetOwner: "player2", targetCharacter: "ben" },
    ]);
  });

  it("証拠1以上のカードが無ければ不発動(abort)", async () => {
    const state = makeState("charlotte", "ben");

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.interrogation.effect, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(true);
  });
});

describe("犯行動機の把握: 相手のアンドロイドに証拠+3", () => {
  it("選んだ対象の証拠が+3される", async () => {
    const state = makeState("charlotte", "ben");
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.motiveGrasp.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(3);
  });
});

describe("痕跡発見: 相手の場のカードに+1、自分の場のカードに-1", () => {
  it("確定テキストの通りに証拠が増減する", async () => {
    let state = makeState("charlotte", "ben");
    state = { ...state, player1: { ...state.player1, board: addEvidence(state.player1.board, "saint", 2) } };
    const chooser = new ScriptedChooser([
      [{ owner: "player2", character: "lucas" }],
      [{ owner: "player1", character: "saint" }],
    ]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.traceDiscovery.effect, "player1", chooser);

    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(1);
    expect(findSlot(result.state.player1.board, "saint").evidence).toBe(1); // 2 - 1
    expect(DEDUCTION_CARD_DEFS.traceDiscovery.confidence).toBe("confirmed");
  });
});

describe("証拠回収: 廃棄場から1枚選んで手札に加える", () => {
  it("選んだカードが手札に移り、廃棄場から消える", async () => {
    const state = makeState("charlotte", "ben", { discardPile: ["tracking", "interrogation"] });
    const chooser = new ScriptedChooser([], ["interrogation"]);

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.evidenceRecovery.effect, "player1", chooser);

    expect(result.state.player1.hand).toEqual(["interrogation"]);
    expect(result.state.deck.discardPile).toEqual(["tracking"]);
  });

  it("廃棄場が空なら不発動(abort)", async () => {
    const state = makeState("charlotte", "ben");

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.evidenceRecovery.effect, "player1", new ScriptedChooser());

    expect(result.aborted).toBe(true);
  });
});

describe("データ整理: 手札を全て廃棄し、5枚になるまで引き直す", () => {
  it("手札が廃棄場へ送られ、山札から5枚まで引き直す", async () => {
    const state = makeState("charlotte", "ben", {
      player1Hand: ["tracking", "tracking", "tracking"],
      drawPile: ["motiveGrasp", "motiveGrasp", "motiveGrasp", "motiveGrasp", "motiveGrasp"],
    });

    const result = await resolveEffect(state, DEDUCTION_CARD_DEFS.dataOrganization.effect, "player1", new ScriptedChooser());

    expect(result.state.player1.hand).toEqual(["motiveGrasp", "motiveGrasp", "motiveGrasp", "motiveGrasp", "motiveGrasp"]);
    expect(result.state.deck.discardPile).toEqual(["tracking", "tracking", "tracking"]);
  });
});
