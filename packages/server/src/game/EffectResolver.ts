import type {
  BoardSide,
  BoardSlot,
  CardEffectScript,
  CharacterId,
  Chooser,
  DeductionCardId,
  EffectCondition,
  EffectLogEntry,
  EffectStep,
  PlayerId,
  TargetFilter,
  TargetRef,
  ValueExpr,
} from "@erroroid/shared";
import { CHARACTER_IDS, HAND_SIZE, otherPlayer } from "@erroroid/shared";
import { CUSTOM_EFFECT_HANDLERS } from "../cards/customHandlers/index.js";
import { findSlot, openSlot, setEvidence } from "./Board.js";
import { discard, draw } from "./Deck.js";
import { checkForceOpen } from "./ForceOpenChecker.js";
import type { GameState } from "./GameState.js";
import { decideOliverTrigger } from "./TriggeredAbility.js";

/**
 * 実際の対象選択(selectTarget/selectFromBound)・廃棄場からの1枚選択は
 * 本物のプレイヤーの意思決定を要する。ネットワーク層(ステップ3)では
 * ソケット越しに人間へ問い合わせる実装を、テストでは決め打ち/キュー方式の
 * モック実装を、それぞれこのインターフェースの実装として差し込む。
 *
 * askTruthはサーバーが実際の秘匿状態から機械的に真偽を算出するため、
 * ここには含まれない(人間へのプロンプトは発生しない)。
 */
export interface EffectChooser {
  selectTargets(args: {
    chooser: PlayerId;
    candidates: readonly TargetRef[];
    count: number;
  }): readonly TargetRef[] | Promise<readonly TargetRef[]>;

  chooseDiscardCard(args: {
    chooser: PlayerId;
    candidates: readonly DeductionCardId[];
  }): DeductionCardId | Promise<DeductionCardId>;
}

export type { EffectLogEntry } from "@erroroid/shared";

export interface EffectResolutionResult {
  readonly state: GameState;
  readonly log: readonly EffectLogEntry[];
  /** ERROROIDが(強制オープンか効果オープンかを問わず)オープンされ即座にゲーム終了した場合に設定される */
  readonly gameOver?: { readonly loser: PlayerId; readonly character: CharacterId };
  /** 発動条件を満たさず(対象不足・存在質問の対象なし等)効果が不発動に終わった場合true */
  readonly aborted: boolean;
}

export interface ResolveEffectOptions {
  readonly rng?: () => number;
}

function resolveBoardOwner(actingPlayer: PlayerId, board: BoardSide): PlayerId {
  return board === "ownerSelf" ? actingPlayer : otherPlayer(actingPlayer);
}

function resolveChooserPlayer(actingPlayer: PlayerId, chooser: Chooser): PlayerId {
  return chooser === "self" ? actingPlayer : otherPlayer(actingPlayer);
}

function meetsFilter(slot: BoardSlot, filter?: TargetFilter): boolean {
  if (!filter) return true;
  if (filter.minEvidence !== undefined && slot.evidence < filter.minEvidence) return false;
  return true;
}

function resolveValue(expr: ValueExpr, values: Readonly<Record<string, number>>): number {
  if (typeof expr === "number") return expr;
  const v = values[expr.ref];
  if (v === undefined) {
    throw new Error(`unbound value ref: ${expr.ref}`);
  }
  return v;
}

function setPlayerBoard(state: GameState, owner: PlayerId, board: BoardSlot[]): GameState {
  return { ...state, [owner]: { ...state[owner], board } };
}

function validateChosen(
  chosen: readonly TargetRef[],
  candidates: readonly TargetRef[],
  count: number,
): void {
  if (chosen.length !== count) {
    throw new Error(`expected ${count} target(s), got ${chosen.length}`);
  }
  for (const ref of chosen) {
    const ok = candidates.some((c) => c.owner === ref.owner && c.character === ref.character);
    if (!ok) {
      throw new Error(`chosen target ${ref.owner}/${ref.character} is not among candidates`);
    }
  }
}

function evaluateCondition(
  condition: EffectCondition,
  state: GameState,
  bindings: Readonly<Record<string, readonly TargetRef[]>>,
): boolean {
  switch (condition.kind) {
    case "evidenceAtLeast": {
      const refs = bindings[condition.target] ?? [];
      if (refs.length === 0) return false;
      return refs.every((ref) => findSlot(state[ref.owner].board, ref.character).evidence >= condition.min);
    }
    default:
      return false;
  }
}

/**
 * カード効果DSL(EffectStep[])を実際のGameStateに対して解決する。
 * chooser/boardの解決(自分/相手 → player1/player2への写像)・強制オープンによる
 * ERROROID即終了・発動条件不足時の不発動、をすべてここで一元管理する。
 */
export async function resolveEffect(
  state: GameState,
  script: CardEffectScript,
  actingPlayer: PlayerId,
  chooser: EffectChooser,
  options: ResolveEffectOptions = {},
): Promise<EffectResolutionResult> {
  const rng = options.rng ?? Math.random;
  let s = state;
  const bindings: Record<string, readonly TargetRef[]> = {};
  const values: Record<string, number> = {};
  const log: EffectLogEntry[] = [];
  let gameOver: { loser: PlayerId; character: CharacterId } | undefined;
  let aborted = false;

  /**
   * 証拠を絶対値newValueに書き換え、直後に
   * (1) 証拠がアリバイ以上になっていれば即座に強制オープン(効果発動中でも)、
   * (2) オリバーの常在トリガー(相手ターン中に証拠が丁度4になった瞬間)
   * を判定する。オリバーのトリガーが発動した場合は「全アンドロイド証拠+1」を
   * 再帰的に同じチェックへ通す(cascading force-openを正しく扱うため)。
   * 戻り値がfalseなら以降の効果解決を打ち切る(ERROROIDオープンによるゲーム終了)。
   */
  function applyEvidenceMutation(ref: TargetRef, newValue: number): boolean {
    const before = findSlot(s[ref.owner].board, ref.character).evidence;
    s = setPlayerBoard(s, ref.owner, setEvidence(s[ref.owner].board, ref.character, newValue));
    if (newValue !== before) {
      log.push({ kind: "evidenceChanged", owner: ref.owner, character: ref.character, before, after: newValue });
    }

    const forceOpenOutcome = checkForceOpen(s, ref.owner, ref.character);
    s = forceOpenOutcome.state;
    if (forceOpenOutcome.opened) {
      log.push({ kind: "open", owner: ref.owner, character: ref.character, identity: forceOpenOutcome.identity! });
      if (forceOpenOutcome.identity === "ERROROID") {
        gameOver = { loser: ref.owner, character: ref.character };
        return false;
      }
    }

    const oliverDecision = decideOliverTrigger(s, ref.owner, ref.character, before, actingPlayer);
    if (oliverDecision.fires && oliverDecision.oliverOwner) {
      const oliverOwner = oliverDecision.oliverOwner;
      const oliverSlot = findSlot(s[oliverOwner].board, "oliver");
      s = setPlayerBoard(s, oliverOwner, openSlot(s[oliverOwner].board, "oliver"));
      log.push({ kind: "open", owner: oliverOwner, character: "oliver", identity: oliverSlot.identity });
      if (oliverSlot.identity === "ERROROID") {
        gameOver = { loser: oliverOwner, character: "oliver" };
        return false;
      }
      log.push({ kind: "oliverTriggered", owner: oliverOwner });
      const affectedOwner = otherPlayer(oliverOwner);
      for (const character of CHARACTER_IDS) {
        const current = findSlot(s[affectedOwner].board, character).evidence;
        const cont = applyEvidenceMutation({ owner: affectedOwner, character }, current + 1);
        if (!cont) return false;
      }
    }

    return true;
  }

  async function run(steps: readonly EffectStep[]): Promise<boolean> {
    for (const step of steps) {
      switch (step.kind) {
        case "selectTarget": {
          const boardOwner = resolveBoardOwner(actingPlayer, step.board);
          const candidates: TargetRef[] = s[boardOwner].board
            .filter((slot) => !slot.isOpen && meetsFilter(slot, step.filter))
            .map((slot) => ({ owner: boardOwner, character: slot.character }));
          if (candidates.length < step.count) {
            aborted = true;
            return false;
          }
          const chooserPlayer = resolveChooserPlayer(actingPlayer, step.chooser);
          const chosen = await chooser.selectTargets({
            chooser: chooserPlayer,
            candidates,
            count: step.count,
          });
          validateChosen(chosen, candidates, step.count);
          bindings[step.bindAs] = chosen;
          break;
        }

        case "selectFromBound": {
          const pool = bindings[step.source] ?? [];
          if (pool.length < step.count) {
            aborted = true;
            return false;
          }
          const chooserPlayer = resolveChooserPlayer(actingPlayer, step.chooser);
          const chosen = await chooser.selectTargets({
            chooser: chooserPlayer,
            candidates: pool,
            count: step.count,
          });
          validateChosen(chosen, pool, step.count);
          bindings[step.bindAs] = chosen;
          break;
        }

        case "addEvidence": {
          const amount = resolveValue(step.amount, values);
          for (const ref of bindings[step.target] ?? []) {
            const current = findSlot(s[ref.owner].board, ref.character).evidence;
            const cont = applyEvidenceMutation(ref, Math.max(0, current + amount));
            if (!cont) return false;
          }
          break;
        }

        case "setEvidence": {
          const amount = resolveValue(step.amount, values);
          for (const ref of bindings[step.target] ?? []) {
            const slot = findSlot(s[ref.owner].board, ref.character);
            if (step.captureDeltaAs) {
              values[step.captureDeltaAs] = slot.evidence - amount;
            }
            const cont = applyEvidenceMutation(ref, Math.max(0, amount));
            if (!cont) return false;
          }
          break;
        }

        case "forceOpen": {
          for (const ref of bindings[step.target] ?? []) {
            const slot = findSlot(s[ref.owner].board, ref.character);
            if (slot.isOpen) continue;
            s = setPlayerBoard(s, ref.owner, openSlot(s[ref.owner].board, ref.character));
            log.push({ kind: "open", owner: ref.owner, character: ref.character, identity: slot.identity });
            if (slot.identity === "ERROROID") {
              gameOver = { loser: ref.owner, character: ref.character };
              return false;
            }
          }
          break;
        }

        case "drawCard": {
          const drawCount =
            step.amount === "fillToHandSize"
              ? Math.max(0, HAND_SIZE - s[actingPlayer].hand.length)
              : step.amount;
          let deck = s.deck;
          const drawnCards: DeductionCardId[] = [];
          for (let i = 0; i < drawCount; i++) {
            const result = draw(deck, rng);
            deck = result.deck;
            if (result.card === undefined) break;
            drawnCards.push(result.card);
          }
          s = {
            ...s,
            deck,
            [actingPlayer]: { ...s[actingPlayer], hand: [...s[actingPlayer].hand, ...drawnCards] },
          };
          break;
        }

        case "discardCard": {
          let deck = s.deck;
          for (const card of s[actingPlayer].hand) {
            deck = discard(deck, card);
          }
          s = { ...s, deck, [actingPlayer]: { ...s[actingPlayer], hand: [] } };
          break;
        }

        case "peekHand": {
          // 現行カードでは未使用。将来カード用の予約プリミティブ(型のみ定義済み)。
          break;
        }

        case "recoverFromDiscard": {
          const discardPile = s.deck.discardPile;
          if (discardPile.length === 0) {
            aborted = true;
            return false;
          }
          const picked = await chooser.chooseDiscardCard({
            chooser: actingPlayer,
            candidates: [...discardPile],
          });
          const idx = discardPile.indexOf(picked);
          if (idx === -1) {
            throw new Error(`invalid discard pick: ${picked}`);
          }
          const newDiscard = [...discardPile.slice(0, idx), ...discardPile.slice(idx + 1)];
          s = {
            ...s,
            deck: { ...s.deck, discardPile: newDiscard },
            [actingPlayer]: { ...s[actingPlayer], hand: [...s[actingPlayer].hand, picked] },
          };
          break;
        }

        case "askTruth": {
          if (step.mode === "isTargetErroroid") {
            const refs = bindings[step.target ?? ""] ?? [];
            const ref = refs[0];
            if (!ref) break;
            const slot = findSlot(s[ref.owner].board, ref.character);
            log.push({
              kind: "truthAnswer",
              question: "isTargetErroroid",
              answer: slot.identity === "ERROROID",
              targetOwner: ref.owner,
              targetCharacter: ref.character,
            });
          } else {
            const boardOwner = resolveBoardOwner(actingPlayer, step.board ?? "ownerOpponent");
            const candidates = s[boardOwner].board.filter(
              (slot) => !slot.isOpen && meetsFilter(slot, step.filter),
            );
            if (candidates.length === 0) {
              aborted = true;
              return false;
            }
            const answer = candidates.some((slot) => slot.identity === "ERROROID");
            log.push({ kind: "truthAnswer", question: "existsInFilteredSet", answer, boardOwner });
          }
          break;
        }

        case "conditionalFlag": {
          const result = evaluateCondition(step.condition, s, bindings);
          const cont = await run(result ? step.then : (step.else ?? []));
          if (!cont) return false;
          break;
        }

        case "repeat": {
          for (let i = 0; i < step.times; i++) {
            const cont = await run(step.steps);
            if (!cont) return false;
          }
          break;
        }

        case "custom": {
          const handler = CUSTOM_EFFECT_HANDLERS[step.handlerId];
          if (!handler) {
            throw new Error(`unknown custom effect handler: ${step.handlerId}`);
          }
          s = handler(s, actingPlayer);
          break;
        }

        default: {
          const _exhaustive: never = step;
          throw new Error(`unhandled effect step: ${JSON.stringify(_exhaustive)}`);
        }
      }
    }
    return true;
  }

  await run(script);

  return { state: s, log, gameOver, aborted };
}
