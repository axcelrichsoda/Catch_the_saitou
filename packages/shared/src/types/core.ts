/**
 * エラーロイド ドメイン基本型
 *
 * 「ANDOROID」「ERROROID」は誤字ではなく、ルールブック・カード実物の書き起こしに
 * 準拠した正式表記(docs/pc-serene-marshmallowの計画書参照)。
 */

export const CHARACTER_IDS = [
  "charlotte",
  "lucas",
  "ivy",
  "ben",
  "lillian",
  "oliver",
  "saint",
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export type Identity = "ANDOROID" | "ERROROID";

export type PlayerId = "player1" | "player2";

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "player1" ? "player2" : "player1";
}

/** アンドロイドカードの公開情報(コスト・カードNo・アリバイ・効果テキスト)。どちらの正体版も共通。 */
export interface AndroidCardDef {
  readonly character: CharacterId;
  readonly displayName: string;
  readonly cost: number;
  readonly cardNo: number;
  readonly alibi: number;
  /** オープン条件パターン3(自発的コスト支払いによるオープン時)にのみ発動する効果の文言。 */
  readonly effectText: string;
}

export const ANDROID_CARD_DEFS: Readonly<Record<CharacterId, AndroidCardDef>> = {
  charlotte: {
    character: "charlotte",
    displayName: "齋藤さん(探偵)",
    cost: 3,
    cardNo: 1,
    alibi: 5,
    effectText: "相手はアンドロイドを1体選択し、それをオープンする",
  },
  lucas: {
    character: "lucas",
    displayName: "齋藤さん(弁護士)",
    cost: 2,
    cardNo: 2,
    alibi: 5,
    effectText:
      "自分はアンドロイドを1体選択し、それにある証拠を0になるまでマイナスする。その後、相手はアンドロイドを1体選択し、それの証拠を先ほどマイナスした数だけプラスする",
  },
  ivy: {
    character: "ivy",
    displayName: "齋藤さん(美大生)",
    cost: 3,
    cardNo: 3,
    alibi: 5,
    effectText: "自分はアンドロイドを1体選択し、それに証拠+1。これを3回繰り返す(同じアンドロイドを複数回選択しても良い)",
  },
  ben: {
    character: "ben",
    displayName: "齋藤さん(バーテンダー)",
    cost: 2,
    cardNo: 4,
    alibi: 5,
    effectText:
      "相手は証拠が2以上あるアンドロイドの中に、エラーロイドが「いる」か「いない」か答える(証拠2以上のアンドロイドがなければ発動しない)",
  },
  lillian: {
    character: "lillian",
    displayName: "齋藤さん(メイド)",
    cost: 2,
    cardNo: 5,
    alibi: 5,
    effectText: "自分の消費エリアにある推理力を自分の手札と同じ数だけメモリーエリアに戻す(手札が5枚なら戻せる推理力も5)",
  },
  oliver: {
    character: "oliver",
    displayName: "齋藤さん(マジシャン)",
    cost: 0,
    cardNo: 6,
    alibi: 6,
    effectText:
      "自分のターン中のオープンでは効果不発動。相手ターン中に証拠が変動し、このカードにある証拠が丁度4になった時オープンする。その後、全アンドロイドは証拠+1",
  },
  saint: {
    character: "saint",
    displayName: "齋藤さん(猫)",
    cost: 4,
    cardNo: 7,
    alibi: 5,
    effectText: "相手はアンドロイドを1体選択し、それに証拠+4。これを2回繰り返す(同じアンドロイドを複数回選択しても良い)",
  },
};

/** 1プレイヤーの場にある未オープン/オープン済みアンドロイド1体の状態。 */
export interface BoardSlot {
  readonly character: CharacterId;
  readonly identity: Identity;
  readonly isOpen: boolean;
  readonly evidence: number;
}

/** 推理力(インサイト)トークンの、1プレイヤー分の保有状態。 */
export interface PlayerTokens {
  readonly memory: number;
  readonly consumption: number;
}

/** メモリーエリアの上限。プレイヤー2人分でちょうど総量20個と一致する。 */
export const MEMORY_CAP = 10;

export const TOTAL_INSIGHT_TOKENS = 20;

/** ドロー・エンドフェーズ時の目標手札枚数。 */
export const HAND_SIZE = 5;

/**
 * カード文言の実物照合状態(3段階)。
 * - confirmed: 実物カードで文言照合済み
 * - high: 読み取りの自信は高いが実物照合はまだ
 * - stub: 数値・選択主体とも自信が持てず仮テキストで実装(後から差し替え前提)
 */
export type Confidence = "confirmed" | "high" | "stub";
