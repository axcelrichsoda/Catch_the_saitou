/**
 * conditionalFlag ステップで使う条件式。
 * 条件の「評価」自体はGameStateを扱うserver側のEffectResolverが行う。
 * ここでは条件の形(データ)だけを定義する。
 */
export interface EvidenceAtLeastCondition {
  readonly kind: "evidenceAtLeast";
  /** selectTarget等でbindAsした対象を指す */
  readonly target: string;
  readonly min: number;
}

export type EffectCondition = EvidenceAtLeastCondition;
