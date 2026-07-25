import type { CharacterId, PlayerId } from "../types/core.js";
import type { EffectCondition } from "./conditions.js";

/**
 * カード効果DSL。
 *
 * 「選択の主体(誰が選ぶか)」と「対象の場(どちらの場のカードから選ぶか)」は
 * 独立した2軸(計画書の分析に基づく)。chooser/board を別パラメータにすることで
 * 新カード追加時にこの2軸を取り違える実装ミスを防ぐ。
 *
 * - chooser: 'self' = カード使用者本人が選ぶ / 'opponent' = 対戦相手が選ぶ
 * - board:   'ownerSelf' = カード使用者自身の場 / 'ownerOpponent' = カード使用者から見た相手の場
 *   (カード所有者=使用者を基準にした固定軸。chooserが'opponent'でも、boardが指すのは
 *    あくまで「使用者から見た場」なので、「相手(chooser)が、相手自身の場(board=ownerOpponent)
 *    から選ぶ」という組み合わせが頻出する)
 */
export type Chooser = "self" | "opponent";
export type BoardSide = "ownerSelf" | "ownerOpponent";

export interface TargetRef {
  readonly owner: PlayerId;
  readonly character: CharacterId;
}

/** 選択候補の絞り込み条件。常に「未オープンのみ」が前提として掛かった上での追加条件。 */
export interface TargetFilter {
  readonly minEvidence?: number;
}

/** 数値ステップのパラメータ。リテラル値か、以前のステップでcaptureした値への参照。 */
export type ValueExpr = number | { readonly ref: string };

export interface SelectTargetStep {
  readonly kind: "selectTarget";
  readonly chooser: Chooser;
  readonly board: BoardSide;
  readonly count: number;
  readonly filter?: TargetFilter;
  /** 選ばれた対象(複数可)をこの名前でbindし、以降のステップから参照する */
  readonly bindAs: string;
}

/** 直前のselectTargetでbindした候補集合の中から、さらに絞り込んで選ぶ(例: 集団ヒステリー)。 */
export interface SelectFromBoundStep {
  readonly kind: "selectFromBound";
  readonly chooser: Chooser;
  readonly source: string;
  readonly count: number;
  readonly bindAs: string;
}

export interface AddEvidenceStep {
  readonly kind: "addEvidence";
  readonly target: string;
  readonly amount: ValueExpr;
}

export interface SetEvidenceStep {
  readonly kind: "setEvidence";
  readonly target: string;
  readonly amount: ValueExpr;
  /** 変更前後の差分(除去された量)を数値変数として記録し、後続ステップから{ref: captureDeltaAs}で参照可能にする */
  readonly captureDeltaAs?: string;
}

/**
 * カード効果によるオープン(証拠閾値とは無関係の強制オープン、オープン条件パターン2/3)。
 * 通常のアンドロイドが開けば効果不発動でオープンのみ。ERROROIDが開けば即ゲーム終了。
 */
export interface ForceOpenStep {
  readonly kind: "forceOpen";
  readonly target: string;
}

export interface DrawCardStep {
  readonly kind: "drawCard";
  readonly amount: number | "fillToHandSize";
}

export interface DiscardCardStep {
  readonly kind: "discardCard";
  readonly scope: "wholeHand";
}

/**
 * 相手の手札を覗き見る系の効果のための予約プリミティブ。
 * 現行のアンドロイド7種・推理カード9種には使用例が無いが、
 * DSL語彙として定義だけ用意しておく(将来のカード追加を見据えた拡張性確保)。
 */
export interface PeekHandStep {
  readonly kind: "peekHand";
  readonly target: "opponent";
  readonly bindAs: string;
}

/** 廃棄場から1枚選んで自分の手札に加える(証拠回収)。 */
export interface RecoverFromDiscardStep {
  readonly kind: "recoverFromDiscard";
  readonly ifEmpty: "abort";
}

export type AskTruthMode = "isTargetErroroid" | "existsInFilteredSet";

/**
 * 相手に真偽を答えさせる効果。デジタル版では嘘の申告ができないため、
 * サーバーが実際の秘匿状態から機械的に真偽を算出する(人間への質問プロンプトは発生しない)。
 */
export interface AskTruthStep {
  readonly kind: "askTruth";
  readonly mode: AskTruthMode;
  readonly answerer: Chooser;
  /** mode: 'isTargetErroroid' のとき、対象を選んだselectTargetのbindAsを指定 */
  readonly target?: string;
  /** mode: 'existsInFilteredSet' のとき、質問対象の場とフィルタ条件を指定 */
  readonly board?: BoardSide;
  readonly filter?: TargetFilter;
}

export interface ConditionalFlagStep {
  readonly kind: "conditionalFlag";
  readonly condition: EffectCondition;
  readonly then: readonly EffectStep[];
  readonly else?: readonly EffectStep[];
}

export interface RepeatStep {
  readonly kind: "repeat";
  readonly times: number;
  readonly steps: readonly EffectStep[];
}

/** DSLで表現しきれない特殊効果の逃げ道。実体はserver/src/cards/customHandlers側に実装する。 */
export interface CustomStep {
  readonly kind: "custom";
  readonly handlerId: string;
}

export type EffectStep =
  | SelectTargetStep
  | SelectFromBoundStep
  | AddEvidenceStep
  | SetEvidenceStep
  | ForceOpenStep
  | DrawCardStep
  | DiscardCardStep
  | PeekHandStep
  | RecoverFromDiscardStep
  | AskTruthStep
  | ConditionalFlagStep
  | RepeatStep
  | CustomStep;

export type CardEffectScript = readonly EffectStep[];
