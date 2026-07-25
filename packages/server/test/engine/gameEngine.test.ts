import { HAND_SIZE } from "@erroroid/shared";
import { describe, expect, it } from "vitest";
import { findSlot } from "../../src/game/Board.js";
import { createInitialGameState, dispatch } from "../../src/game/GameEngine.js";
import { ScriptedChooser } from "../effects/testHelpers.js";

function setup() {
  return createInitialGameState({
    firstPlayer: "player1",
    player1Erroroid: "ben",
    player2Erroroid: "oliver",
    rng: () => 0.42, // 決定的なシャッフルにするための固定rng
  });
}

describe("createInitialGameState", () => {
  it("先攻は5枚(4枚配札+最初のドローで1枚)、後攻は4枚のまま、thinkingフェーズで開始する", () => {
    const state = setup();

    expect(state.player1.hand).toHaveLength(HAND_SIZE);
    expect(state.player2.hand).toHaveLength(4);
    expect(state.phase).toBe("thinking");
    expect(state.turn).toBe("player1");
    expect(state.player1.tokens.memory).toBe(1); // インストールで1個
    expect(state.deck.drawPile).toHaveLength(40 - 8 - 1);
  });

  it("先攻はrevealFirst、後攻はrevealSecondを持つ", () => {
    const state = setup();
    expect(state.player1.revealCardId).toBe("revealFirst");
    expect(state.player2.revealCardId).toBe("revealSecond");
  });
});

describe("dispatch: 手番以外からの操作は拒否", () => {
  it("手番でないプレイヤーのアクションはエラーになり状態は変化しない", async () => {
    const state = setup();
    const result = await dispatch(
      state,
      { type: "endTurn", player: "player2" },
      new ScriptedChooser(),
    );

    expect(result.error).toBeDefined();
    expect(result.state).toBe(state);
  });
});

describe("dispatch: playDeductionCard", () => {
  it("コストを払い、手札から廃棄場へ送り、効果を解決する", async () => {
    let state = setup();
    state = {
      ...state,
      player1: { ...state.player1, hand: ["tracking"], tokens: { memory: 3, consumption: 0 } },
    };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await dispatch(
      state,
      { type: "playDeductionCard", player: "player1", cardId: "tracking" },
      chooser,
    );

    expect(result.error).toBeUndefined();
    expect(result.state.player1.hand).toEqual([]);
    expect(result.state.deck.discardPile).toEqual(["tracking"]);
    expect(result.state.player1.tokens).toEqual({ memory: 0, consumption: 3 }); // コスト3消費→エンド前なのでまだ消費エリアに残っている
    expect(findSlot(result.state.player2.board, "lucas").evidence).toBe(2);
  });

  it("推理力が不足していればエラーになり状態は変化しない", async () => {
    let state = setup();
    state = {
      ...state,
      player1: { ...state.player1, hand: ["decisiveEvidence"], tokens: { memory: 1, consumption: 0 } },
    };

    const result = await dispatch(
      state,
      { type: "playDeductionCard", player: "player1", cardId: "decisiveEvidence" },
      new ScriptedChooser(),
    );

    expect(result.error).toBe("insufficient insight tokens");
    expect(result.state).toBe(state);
  });

  it("手札に無いカードを使おうとするとエラーになる", async () => {
    const state = setup(); // player1の手札にdecisiveEvidenceは無い

    const result = await dispatch(
      state,
      { type: "playDeductionCard", player: "player1", cardId: "decisiveEvidence" },
      new ScriptedChooser(),
    );

    expect(result.error).toBe("card not in hand");
  });
});

describe("dispatch: openAndroid", () => {
  it("自分のANDROIDカードをオープンして効果を発動する", async () => {
    let state = setup();
    // player1の犯人はben。charlotteはANDROIDなので開けても安全。
    state = { ...state, player1: { ...state.player1, tokens: { memory: 5, consumption: 0 } } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await dispatch(
      state,
      { type: "openAndroid", player: "player1", character: "charlotte" },
      chooser,
    );

    expect(result.error).toBeUndefined();
    expect(findSlot(result.state.player1.board, "charlotte").isOpen).toBe(true);
    expect(result.state.phase).not.toBe("gameOver");
  });

  it("自分のERROROIDをオープンすると効果は発動せず即座に敗北する", async () => {
    let state = setup(); // player1の犯人はben
    state = { ...state, player1: { ...state.player1, tokens: { memory: 5, consumption: 0 } } };

    const result = await dispatch(
      state,
      { type: "openAndroid", player: "player1", character: "ben" },
      new ScriptedChooser(), // 効果は発動しないのでchooserは呼ばれないはず
    );

    expect(result.state.phase).toBe("gameOver");
    expect(result.state.winner).toBe("player2");
    expect(findSlot(result.state.player1.board, "ben").isOpen).toBe(true);
  });

  it("既にオープン済みのカードは再度開けない", async () => {
    let state = setup();
    state = {
      ...state,
      player1: {
        ...state.player1,
        tokens: { memory: 5, consumption: 0 },
        board: state.player1.board.map((s) => (s.character === "charlotte" ? { ...s, isOpen: true } : s)),
      },
    };

    const result = await dispatch(
      state,
      { type: "openAndroid", player: "player1", character: "charlotte" },
      new ScriptedChooser(),
    );

    expect(result.error).toBe("already open");
  });
});

describe("dispatch: useReveal", () => {
  it("相手の犯人を言い当てると勝利する", async () => {
    let state = setup(); // player2の犯人はoliver
    state = { ...state, player1: { ...state.player1, tokens: { memory: 13, consumption: 0 } } };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "oliver" }]]);

    const result = await dispatch(state, { type: "useReveal", player: "player1" }, chooser);

    expect(result.state.phase).toBe("gameOver");
    expect(result.state.winner).toBe("player1");
    expect(result.state.player1.revealCardAvailable).toBe(false);
  });

  it("自分の場のオープン済み枚数だけコストが下がる", async () => {
    let state = setup();
    const openedBoard = state.player1.board.map((s, i) => (i < 3 ? { ...s, isOpen: true } : s));
    state = {
      ...state,
      player1: { ...state.player1, board: openedBoard, tokens: { memory: 10, consumption: 0 } }, // 13 - 3 = 10
    };
    const chooser = new ScriptedChooser([[{ owner: "player2", character: "lucas" }]]);

    const result = await dispatch(state, { type: "useReveal", player: "player1" }, chooser);

    expect(result.error).toBeUndefined();
    expect(result.state.player1.tokens).toEqual({ memory: 0, consumption: 10 }); // 13-3=10消費→エンド前なのでまだ消費エリア
  });

  it("使用済みのリヴィールカードは再使用できない", async () => {
    let state = setup();
    state = {
      ...state,
      player1: { ...state.player1, revealCardAvailable: false, tokens: { memory: 13, consumption: 0 } },
    };

    const result = await dispatch(state, { type: "useReveal", player: "player1" }, new ScriptedChooser());

    expect(result.error).toBe("reveal card already used");
  });
});

describe("dispatch: endTurn", () => {
  it("推理力を全て自分のメモリーへ戻し、手番を相手に渡し、相手のドロー・インストールを自動実行する", async () => {
    const state = setup();

    const result = await dispatch(state, { type: "endTurn", player: "player1" }, new ScriptedChooser());

    expect(result.state.turn).toBe("player2");
    expect(result.state.phase).toBe("thinking");
    expect(result.state.player1.tokens).toEqual({ memory: 1, consumption: 0 }); // 未消費だった1個がそのまま戻る
    expect(result.state.player2.hand).toHaveLength(HAND_SIZE); // 4→5
    expect(result.state.player2.tokens.memory).toBe(1); // 相手もインストールで1個
  });
});
