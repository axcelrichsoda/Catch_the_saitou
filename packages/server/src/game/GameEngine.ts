import {
  ANDROID_CARD_DEFS,
  ANDROID_CARD_EFFECTS,
  computeRevealCost,
  DEDUCTION_CARD_DEFS,
  HAND_SIZE,
  otherPlayer,
  REVEAL_CARD_DEFS,
  type CardEffectScript,
  type CharacterId,
  type DeductionCardId,
  type PlayerId,
} from "@erroroid/shared";
import { validateAction, type GameAction } from "./ActionValidator.js";
import { createInitialBoard, findSlot, openSlot } from "./Board.js";
import { discard, draw, shuffle } from "./Deck.js";
import type { EffectChooser, EffectLogEntry } from "./EffectResolver.js";
import { resolveEffect } from "./EffectResolver.js";
import type { GameState } from "./GameState.js";
import { consume, createInitialPlayerTokens, endPhaseReturnAll, install } from "./Tokens.js";

export interface SetupParams {
  readonly firstPlayer: PlayerId;
  readonly player1Erroroid: CharacterId;
  readonly player2Erroroid: CharacterId;
  readonly rng?: () => number;
}

/**
 * 準備〜配置(ルール1〜4)を行い、先攻プレイヤーのdrawフェーズから開始できる状態を作る。
 * 各プレイヤーへの初期配札は4枚(その後の最初のdrawフェーズで5枚になる)。
 */
export function createInitialGameState(params: SetupParams): GameState {
  const rng = params.rng ?? Math.random;
  const allCards: DeductionCardId[] = [];
  for (const def of Object.values(DEDUCTION_CARD_DEFS)) {
    for (let i = 0; i < def.count; i++) allCards.push(def.id);
  }
  const shuffled = shuffle(allCards, rng);
  const player1Hand = shuffled.slice(0, 4);
  const player2Hand = shuffled.slice(4, 8);
  const drawPile = shuffled.slice(8);

  const raw: GameState = {
    player1: {
      board: createInitialBoard(params.player1Erroroid),
      tokens: createInitialPlayerTokens(),
      hand: player1Hand,
      revealCardId: params.firstPlayer === "player1" ? "revealFirst" : "revealSecond",
      revealCardAvailable: true,
    },
    player2: {
      board: createInitialBoard(params.player2Erroroid),
      tokens: createInitialPlayerTokens(),
      hand: player2Hand,
      revealCardId: params.firstPlayer === "player2" ? "revealFirst" : "revealSecond",
      revealCardAvailable: true,
    },
    deck: { drawPile, discardPile: [] },
    turn: params.firstPlayer,
    phase: "draw",
  };

  // 最初のターンのドロー(4枚→5枚)・インストールはプレイヤーの意思決定を伴わないため、
  // ここで自動的に進めてthinkingフェーズの状態を返す。
  return startTurn(raw);
}

/** 手札が5枚になるまで山札から引く(山札切れ時は廃棄場をシャッフルして山札にする、Deck.drawが内包)。 */
function runDrawPhase(state: GameState): GameState {
  const player = state.turn;
  let deck = state.deck;
  const hand = [...state[player].hand];
  while (hand.length < HAND_SIZE) {
    const result = draw(deck);
    deck = result.deck;
    if (result.card === undefined) break;
    hand.push(result.card);
  }
  return { ...state, deck, [player]: { ...state[player], hand }, phase: "install" };
}

/** インストールエリアから推理力を1個、自分のメモリーエリアへ。 */
function runInstallPhase(state: GameState): GameState {
  const player = state.turn;
  return {
    ...state,
    [player]: { ...state[player], tokens: install(state[player].tokens) },
    phase: "thinking",
  };
}

/** ドロー→インストールは player の意思決定を伴わないため、ターン開始時に自動で流す。 */
function startTurn(state: GameState): GameState {
  return runInstallPhase(runDrawPhase({ ...state, phase: "draw" }));
}

export interface DispatchResult {
  readonly state: GameState;
  readonly log: readonly EffectLogEntry[];
  readonly error?: string;
}

/**
 * GameEngineの唯一のエントリーポイント。手番・フェーズ・コスト・対象の正当性は
 * ActionValidator/EffectResolver内部の検証に委譲する。
 */
export async function dispatch(
  state: GameState,
  action: GameAction,
  chooser: EffectChooser,
): Promise<DispatchResult> {
  const validation = validateAction(state, action);
  if (!validation.ok) {
    return { state, log: [], error: validation.error };
  }

  if (action.type === "endTurn") {
    const player = action.player;
    const ended: GameState = {
      ...state,
      [player]: { ...state[player], tokens: endPhaseReturnAll(state[player].tokens) },
      turn: otherPlayer(player),
    };
    return { state: startTurn(ended), log: [] };
  }

  const player = action.player;
  let s = state;
  let script: CardEffectScript;

  if (action.type === "playDeductionCard") {
    const def = DEDUCTION_CARD_DEFS[action.cardId];
    const hand = [...s[player].hand];
    const idx = hand.indexOf(action.cardId);
    hand.splice(idx, 1);
    s = {
      ...s,
      deck: discard(s.deck, action.cardId),
      [player]: { ...s[player], hand, tokens: consume(s[player].tokens, def.cost) },
    };
    script = def.effect;
  } else if (action.type === "openAndroid") {
    const def = ANDROID_CARD_DEFS[action.character];
    const slot = findSlot(s[player].board, action.character);
    s = {
      ...s,
      [player]: {
        ...s[player],
        tokens: consume(s[player].tokens, def.cost),
        board: openSlot(s[player].board, action.character),
      },
    };
    // FAQ: エラーロイドを効果発動のためオープンした場合、効果は発動せずその時点で即座にゲーム終了・敗北確定
    if (slot.identity === "ERROROID") {
      return {
        state: { ...s, phase: "gameOver", winner: otherPlayer(player) },
        log: [{ kind: "open", owner: player, character: action.character, identity: "ERROROID" }],
      };
    }
    script = ANDROID_CARD_EFFECTS[action.character].effect;
  } else {
    // useReveal
    const openedOwnCount = s[player].board.filter((slot) => slot.isOpen).length;
    const revealDef = REVEAL_CARD_DEFS[s[player].revealCardId];
    const cost = computeRevealCost(revealDef, openedOwnCount);
    s = {
      ...s,
      [player]: { ...s[player], tokens: consume(s[player].tokens, cost), revealCardAvailable: false },
    };
    script = revealDef.effect;
  }

  const effectResult = await resolveEffect(s, script, player, chooser);
  s = effectResult.state;

  if (effectResult.gameOver) {
    return {
      state: { ...s, phase: "gameOver", winner: otherPlayer(effectResult.gameOver.loser) },
      log: effectResult.log,
    };
  }

  return { state: s, log: effectResult.log };
}
