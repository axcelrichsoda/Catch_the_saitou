/**
 * 山札・廃棄場の汎用操作。カードの中身(推理カード等)には依存しない。
 * 具体的なカードデータ定義は shared/src/cards 側(ステップ2)で扱う。
 */
export interface DeckState<T> {
  readonly drawPile: readonly T[];
  readonly discardPile: readonly T[];
}

export function createDeck<T>(cards: readonly T[]): DeckState<T> {
  return { drawPile: [...cards], discardPile: [] };
}

export function shuffle<T>(cards: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export interface DrawResult<T> {
  readonly card: T | undefined;
  readonly deck: DeckState<T>;
}

/** 山札から1枚引く。山札切れ時は廃棄場をシャッフルして山札にしてから引く。 */
export function draw<T>(deck: DeckState<T>, rng: () => number = Math.random): DrawResult<T> {
  if (deck.drawPile.length === 0) {
    if (deck.discardPile.length === 0) {
      return { card: undefined, deck };
    }
    const reshuffled = shuffle(deck.discardPile, rng);
    const [card, ...rest] = reshuffled;
    return { card, deck: { drawPile: rest, discardPile: [] } };
  }
  const [card, ...rest] = deck.drawPile;
  return { card, deck: { ...deck, drawPile: rest } };
}

export function discard<T>(deck: DeckState<T>, card: T): DeckState<T> {
  return { ...deck, discardPile: [...deck.discardPile, card] };
}
