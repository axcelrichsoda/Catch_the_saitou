import type { CardEffectScript } from "../../effects/script.js";
import type { Confidence } from "../../types/core.js";

export const DEDUCTION_CARD_IDS = [
  "tracking",
  "suspiciousBehavior",
  "mobHysteria",
  "decisiveEvidence",
  "interrogation",
  "motiveGrasp",
  "traceDiscovery",
  "evidenceRecovery",
  "dataOrganization",
] as const;

export type DeductionCardId = (typeof DEDUCTION_CARD_IDS)[number];

export interface DeductionCardDef {
  readonly id: DeductionCardId;
  readonly displayName: string;
  readonly cost: number;
  /** 山札40枚中のこのカードの枚数 */
  readonly count: number;
  readonly confidence: Confidence;
  /** プレイヤー向けの効果文言(実物カードの書き起こし)。 */
  readonly effectText: string;
  readonly effect: CardEffectScript;
}

export const DEDUCTION_CARD_DEFS: Readonly<Record<DeductionCardId, DeductionCardDef>> = {
  tracking: {
    id: "tracking",
    displayName: "追跡",
    cost: 3,
    count: 4,
    confidence: "confirmed",
    effectText: "自分はアンドロイドを1体選択し、それに証拠+2",
    effect: [
      { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 1, bindAs: "target" },
      { kind: "addEvidence", target: "target", amount: 2 },
    ],
  },
  suspiciousBehavior: {
    id: "suspiciousBehavior",
    displayName: "単独不審",
    cost: 2,
    count: 5,
    confidence: "confirmed",
    effectText: "相手はアンドロイドを1体選択する。それに1以上の証拠が既にあれば証拠+4、証拠がない場合は証拠+2",
    effect: [
      { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "target" },
      {
        kind: "conditionalFlag",
        condition: { kind: "evidenceAtLeast", target: "target", min: 1 },
        then: [{ kind: "addEvidence", target: "target", amount: 4 }],
        else: [{ kind: "addEvidence", target: "target", amount: 2 }],
      },
    ],
  },
  mobHysteria: {
    id: "mobHysteria",
    displayName: "集団ヒステリー",
    cost: 3,
    count: 5,
    confidence: "confirmed",
    effectText: "自分はアンドロイドを3体選択。相手はその中から2体選択し証拠+2(3体選択できなければ不発動)",
    effect: [
      { kind: "selectTarget", chooser: "self", board: "ownerOpponent", count: 3, bindAs: "pool" },
      { kind: "selectFromBound", chooser: "opponent", source: "pool", count: 2, bindAs: "chosen" },
      { kind: "addEvidence", target: "chosen", amount: 2 },
    ],
  },
  decisiveEvidence: {
    id: "decisiveEvidence",
    displayName: "決定的証拠",
    cost: 4,
    count: 2,
    confidence: "confirmed",
    effectText: "相手はアンドロイドを1体選択し、証拠+5",
    effect: [
      { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "target" },
      { kind: "addEvidence", target: "target", amount: 5 },
    ],
  },
  interrogation: {
    id: "interrogation",
    displayName: "尋問",
    cost: 1,
    count: 3,
    confidence: "confirmed",
    effectText:
      "相手は証拠1以上のアンドロイドを1体選択する。それがエラーロイドで「ある/ない」を答える(証拠が1以上あるアンドロイドがいなければ不発動)",
    effect: [
      {
        kind: "selectTarget",
        chooser: "opponent",
        board: "ownerOpponent",
        count: 1,
        filter: { minEvidence: 1 },
        bindAs: "target",
      },
      { kind: "askTruth", mode: "isTargetErroroid", answerer: "opponent", target: "target" },
    ],
  },
  motiveGrasp: {
    id: "motiveGrasp",
    displayName: "犯行動機の把握",
    cost: 2,
    count: 6,
    confidence: "confirmed",
    effectText: "相手はアンドロイドを1体選択し、証拠+3",
    effect: [
      { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "target" },
      { kind: "addEvidence", target: "target", amount: 3 },
    ],
  },
  traceDiscovery: {
    id: "traceDiscovery",
    displayName: "痕跡発見",
    cost: 1,
    count: 10,
    confidence: "confirmed",
    effectText: "相手はアンドロイドを1体選択し証拠+1、その後自分はアンドロイドを1体選択し証拠-1",
    effect: [
      { kind: "selectTarget", chooser: "opponent", board: "ownerOpponent", count: 1, bindAs: "a" },
      { kind: "addEvidence", target: "a", amount: 1 },
      { kind: "selectTarget", chooser: "self", board: "ownerSelf", count: 1, bindAs: "b" },
      { kind: "addEvidence", target: "b", amount: -1 },
    ],
  },
  evidenceRecovery: {
    id: "evidenceRecovery",
    displayName: "証拠回収",
    cost: 2,
    count: 3,
    confidence: "confirmed",
    effectText: "廃棄場から好きなカードを1枚選び、相手に見せてから自分の手札に加える(廃棄場にカードがなければ不発動)",
    effect: [{ kind: "recoverFromDiscard", ifEmpty: "abort" }],
  },
  dataOrganization: {
    id: "dataOrganization",
    displayName: "データ整理",
    cost: 1,
    count: 2,
    confidence: "confirmed",
    effectText: "自分の手札を全て廃棄場に送り、その後手札が5枚になるよう山札から引く",
    effect: [
      { kind: "discardCard", scope: "wholeHand" },
      { kind: "drawCard", amount: "fillToHandSize" },
    ],
  },
};

export const DEDUCTION_DECK_SIZE = Object.values(DEDUCTION_CARD_DEFS).reduce(
  (sum, def) => sum + def.count,
  0,
);
