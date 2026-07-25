import { describe, expect, it } from "vitest";
import { createDeck, discard, draw, shuffle } from "../../src/game/Deck.js";

describe("shuffle", () => {
  it("元の配列を破壊せず、同じ要素集合を返す", () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original, () => 0.5);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("rngを固定すれば決定的な結果になる", () => {
    const a = shuffle([1, 2, 3, 4, 5], () => 0.1);
    const b = shuffle([1, 2, 3, 4, 5], () => 0.1);
    expect(a).toEqual(b);
  });
});

describe("draw", () => {
  it("山札の先頭から1枚引く", () => {
    const deck = createDeck([1, 2, 3]);
    const { card, deck: next } = draw(deck);
    expect(card).toBe(1);
    expect(next.drawPile).toEqual([2, 3]);
  });

  it("山札が切れたら廃棄場をシャッフルして山札にしてから引く", () => {
    const deck = { drawPile: [], discardPile: [1, 2, 3] };
    const { card, deck: next } = draw(deck, () => 0);
    expect(card).toBeDefined();
    expect(next.discardPile).toEqual([]);
    expect(next.drawPile).toHaveLength(2);
  });

  it("山札・廃棄場ともに空なら引けない(undefined)", () => {
    const deck = createDeck<number>([]);
    const { card, deck: next } = draw(deck);
    expect(card).toBeUndefined();
    expect(next).toEqual(deck);
  });
});

describe("discard", () => {
  it("廃棄場の末尾にカードを積む", () => {
    const deck = createDeck([1, 2]);
    const next = discard(deck, 99);
    expect(next.discardPile).toEqual([99]);
    expect(next.drawPile).toEqual([1, 2]);
  });
});
