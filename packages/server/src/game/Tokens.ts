import { MEMORY_CAP, type PlayerTokens } from "@erroroid/shared";

export function createInitialPlayerTokens(): PlayerTokens {
  return { memory: 0, consumption: 0 };
}

/**
 * インストールエリアからメモリーエリアへ推理力を1個移す。
 * メモリーエリアが上限(10個)に達している場合は何もしない
 * (総量20個=プレイヤー2人分の上限と一致するため、この状態は正常な範囲内で起こりうる)。
 */
export function install(tokens: PlayerTokens): PlayerTokens {
  if (tokens.memory >= MEMORY_CAP) {
    return tokens;
  }
  return { ...tokens, memory: tokens.memory + 1 };
}

/** メモリーエリアから消費エリアへ推理力を移す(カード使用コストの支払い)。 */
export function consume(tokens: PlayerTokens, amount: number): PlayerTokens {
  if (amount < 0) {
    throw new Error(`amount must be >= 0, got ${amount}`);
  }
  if (tokens.memory < amount) {
    throw new Error(
      `insufficient insight tokens: have ${tokens.memory}, need ${amount}`,
    );
  }
  return { memory: tokens.memory - amount, consumption: tokens.consumption + amount };
}

/** エンドフェーズ: 消費エリアの推理力を全てメモリーエリアへ戻す。 */
export function endPhaseReturnAll(tokens: PlayerTokens): PlayerTokens {
  return { memory: tokens.memory + tokens.consumption, consumption: 0 };
}

/** 消費エリアからメモリーエリアへ、指定した量だけ戻す(保有分を超えては戻せない)。リリアンの効果で使用。 */
export function returnPartial(tokens: PlayerTokens, amount: number): PlayerTokens {
  const moved = Math.min(tokens.consumption, Math.max(0, amount));
  return { memory: tokens.memory + moved, consumption: tokens.consumption - moved };
}
