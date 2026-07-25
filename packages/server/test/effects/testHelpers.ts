import type { CharacterId, DeductionCardId, TargetRef } from "@erroroid/shared";
import { createInitialBoard } from "../../src/game/Board.js";
import { createDeck } from "../../src/game/Deck.js";
import type { GameState } from "../../src/game/GameState.js";
import { createInitialPlayerTokens } from "../../src/game/Tokens.js";
import type { EffectChooser } from "../../src/game/EffectResolver.js";

export function makeState(
  player1Erroroid: CharacterId,
  player2Erroroid: CharacterId,
  overrides: {
    player1Hand?: DeductionCardId[];
    player2Hand?: DeductionCardId[];
    discardPile?: DeductionCardId[];
    drawPile?: DeductionCardId[];
  } = {},
): GameState {
  return {
    player1: {
      board: createInitialBoard(player1Erroroid),
      tokens: createInitialPlayerTokens(),
      hand: overrides.player1Hand ?? [],
      revealCardId: "revealFirst",
      revealCardAvailable: true,
    },
    player2: {
      board: createInitialBoard(player2Erroroid),
      tokens: createInitialPlayerTokens(),
      hand: overrides.player2Hand ?? [],
      revealCardId: "revealSecond",
      revealCardAvailable: true,
    },
    deck: {
      ...createDeck<DeductionCardId>(overrides.drawPile ?? []),
      discardPile: overrides.discardPile ?? [],
    },
    turn: "player1",
    phase: "thinking",
  };
}

/** あらかじめ決め打った選択結果を順番に返すモックチューザー。 */
export class ScriptedChooser implements EffectChooser {
  private targetQueue: (readonly TargetRef[])[];
  private discardQueue: DeductionCardId[];

  constructor(
    targetQueue: (readonly TargetRef[])[] = [],
    discardQueue: DeductionCardId[] = [],
  ) {
    this.targetQueue = [...targetQueue];
    this.discardQueue = [...discardQueue];
  }

  selectTargets(): readonly TargetRef[] {
    const next = this.targetQueue.shift();
    if (!next) {
      throw new Error("ScriptedChooser: no more queued target selections");
    }
    return next;
  }

  chooseDiscardCard(): DeductionCardId {
    const next = this.discardQueue.shift();
    if (!next) {
      throw new Error("ScriptedChooser: no more queued discard picks");
    }
    return next;
  }
}
