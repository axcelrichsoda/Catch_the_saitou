import { describe, expect, it } from "vitest";
import {
  consume,
  createInitialPlayerTokens,
  endPhaseReturnAll,
  install,
} from "../../src/game/Tokens.js";

describe("install", () => {
  it("メモリーエリアに1個ずつ足す", () => {
    let tokens = createInitialPlayerTokens();
    tokens = install(tokens);
    expect(tokens).toEqual({ memory: 1, consumption: 0 });
  });

  it("上限10個に達したら増えない(クローズドループの前提を壊さない)", () => {
    let tokens = createInitialPlayerTokens();
    for (let i = 0; i < 15; i++) {
      tokens = install(tokens);
    }
    expect(tokens.memory).toBe(10);
  });
});

describe("consume", () => {
  it("メモリーから消費エリアへ移す", () => {
    const tokens = { memory: 5, consumption: 0 };
    expect(consume(tokens, 3)).toEqual({ memory: 2, consumption: 3 });
  });

  it("保有数を超えて消費しようとするとエラー", () => {
    const tokens = { memory: 2, consumption: 0 };
    expect(() => consume(tokens, 3)).toThrow();
  });

  it("負の量を消費しようとするとエラー", () => {
    const tokens = { memory: 5, consumption: 0 };
    expect(() => consume(tokens, -1)).toThrow();
  });

  it("0個消費してもエラーにならず状態は変わらない", () => {
    const tokens = { memory: 5, consumption: 0 };
    expect(consume(tokens, 0)).toEqual({ memory: 5, consumption: 0 });
  });
});

describe("endPhaseReturnAll", () => {
  it("消費エリアの推理力を全てメモリーエリアへ戻す", () => {
    const tokens = { memory: 2, consumption: 6 };
    expect(endPhaseReturnAll(tokens)).toEqual({ memory: 8, consumption: 0 });
  });
});

describe("推理力トークンのクローズドループ(install→consume→endPhaseで総量が保存される)", () => {
  it("一連の操作を経てもプレイヤーの保有総量(memory+consumption)は増減しない", () => {
    let tokens = createInitialPlayerTokens();
    tokens = install(tokens);
    tokens = install(tokens);
    tokens = install(tokens);
    const totalAfterInstall = tokens.memory + tokens.consumption;

    tokens = consume(tokens, 2);
    expect(tokens.memory + tokens.consumption).toBe(totalAfterInstall);

    tokens = endPhaseReturnAll(tokens);
    expect(tokens.memory + tokens.consumption).toBe(totalAfterInstall);
    expect(tokens.consumption).toBe(0);
  });
});
