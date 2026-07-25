import { describe, expect, it } from "vitest";
import {
  addEvidence,
  createInitialBoard,
  findForceOpenTargets,
  findSlot,
  openSlot,
  setEvidence,
  shouldForceOpen,
} from "../../src/game/Board.js";

describe("createInitialBoard", () => {
  it("7キャラ分のスロットを、指定した1キャラだけERROROIDにして生成する", () => {
    const board = createInitialBoard("ivy");

    expect(board).toHaveLength(7);
    for (const slot of board) {
      if (slot.character === "ivy") {
        expect(slot.identity).toBe("ERROROID");
      } else {
        expect(slot.identity).toBe("ANDOROID");
      }
      expect(slot.isOpen).toBe(false);
      expect(slot.evidence).toBe(0);
    }
  });

  it("カードNo順(charlotte→lucas→...→saint)に並ぶ", () => {
    const board = createInitialBoard("saint");
    expect(board.map((s) => s.character)).toEqual([
      "charlotte",
      "lucas",
      "ivy",
      "ben",
      "lillian",
      "oliver",
      "saint",
    ]);
  });
});

describe("addEvidence / setEvidence", () => {
  it("証拠を加算できる", () => {
    const board = createInitialBoard("charlotte");
    const next = addEvidence(board, "lucas", 3);
    expect(findSlot(next, "lucas").evidence).toBe(3);
  });

  it("証拠は0未満にならない(addEvidenceでマイナス)", () => {
    const board = createInitialBoard("charlotte");
    const withEvidence = addEvidence(board, "lucas", 2);
    const next = addEvidence(withEvidence, "lucas", -5);
    expect(findSlot(next, "lucas").evidence).toBe(0);
  });

  it("証拠は0未満にならない(setEvidenceでマイナス値指定)", () => {
    const board = createInitialBoard("charlotte");
    const next = setEvidence(board, "lucas", -10);
    expect(findSlot(next, "lucas").evidence).toBe(0);
  });

  it("他のスロットには影響しない(イミュータブル)", () => {
    const board = createInitialBoard("charlotte");
    const next = addEvidence(board, "lucas", 3);
    expect(findSlot(board, "lucas").evidence).toBe(0);
    expect(findSlot(next, "ben").evidence).toBe(0);
  });
});

describe("openSlot", () => {
  it("指定したキャラのisOpenをtrueにする", () => {
    const board = createInitialBoard("charlotte");
    const next = openSlot(board, "saint");
    expect(findSlot(next, "saint").isOpen).toBe(true);
    expect(findSlot(board, "saint").isOpen).toBe(false);
  });
});

describe("shouldForceOpen / findForceOpenTargets", () => {
  it("証拠がアリバイ(5)未満なら強制オープン対象外", () => {
    const board = addEvidence(createInitialBoard("charlotte"), "lucas", 4);
    expect(shouldForceOpen(findSlot(board, "lucas"))).toBe(false);
    expect(findForceOpenTargets(board)).toHaveLength(0);
  });

  it("証拠がアリバイ(5)以上になったら強制オープン対象", () => {
    const board = addEvidence(createInitialBoard("charlotte"), "lucas", 5);
    expect(shouldForceOpen(findSlot(board, "lucas"))).toBe(true);
    expect(findForceOpenTargets(board).map((s) => s.character)).toEqual(["lucas"]);
  });

  it("オリバーはアリバイ6のため証拠5では対象外、6で対象になる", () => {
    const board5 = addEvidence(createInitialBoard("charlotte"), "oliver", 5);
    expect(shouldForceOpen(findSlot(board5, "oliver"))).toBe(false);

    const board6 = addEvidence(createInitialBoard("charlotte"), "oliver", 6);
    expect(shouldForceOpen(findSlot(board6, "oliver"))).toBe(true);
  });

  it("既にオープン済みのカードは強制オープン対象に含めない", () => {
    const board = openSlot(
      addEvidence(createInitialBoard("charlotte"), "lucas", 10),
      "lucas",
    );
    expect(findForceOpenTargets(board)).toHaveLength(0);
  });
});

describe("findSlot", () => {
  it("存在しないキャラを渡すとエラーになる", () => {
    const board = createInitialBoard("charlotte").filter((s) => s.character !== "ben");
    expect(() => findSlot(board, "ben")).toThrow();
  });
});
