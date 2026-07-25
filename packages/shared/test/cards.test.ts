import { describe, expect, it } from "vitest";
import {
  ANDROID_CARD_EFFECTS,
  CHARACTER_IDS,
  DEDUCTION_CARD_DEFS,
  DEDUCTION_DECK_SIZE,
  REVEAL_CARD_DEFS,
} from "../src/index.js";

describe("カードデータの棚卸し", () => {
  it("推理カード山札は合計40枚", () => {
    expect(DEDUCTION_DECK_SIZE).toBe(40);
  });

  it("アンドロイドカードは7キャラ全て定義されている", () => {
    for (const character of CHARACTER_IDS) {
      expect(ANDROID_CARD_EFFECTS[character]).toBeDefined();
      expect(ANDROID_CARD_EFFECTS[character].character).toBe(character);
    }
  });

  it("推理カードは実物照合が完了しすべてconfidence: confirmed", () => {
    for (const def of Object.values(DEDUCTION_CARD_DEFS)) {
      expect(def.confidence).toBe("confirmed");
    }
  });

  it("真相解明カードは先攻13/後攻12を基準値として持つ", () => {
    expect(REVEAL_CARD_DEFS.revealFirst.baseCost).toBe(13);
    expect(REVEAL_CARD_DEFS.revealSecond.baseCost).toBe(12);
  });
});
