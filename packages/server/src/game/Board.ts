import {
  ANDROID_CARD_DEFS,
  CHARACTER_IDS,
  type BoardSlot,
  type CharacterId,
} from "@erroroid/shared";

/**
 * 1プレイヤー分の初期盤面を作る。
 * erroroidCharacter が真犯人(裏ERROROID版)、残り6キャラは裏ANDOROID版。
 * 左から並べる順序はカードNo順(1〜7)で固定。
 */
export function createInitialBoard(erroroidCharacter: CharacterId): BoardSlot[] {
  return [...CHARACTER_IDS]
    .sort((a, b) => ANDROID_CARD_DEFS[a].cardNo - ANDROID_CARD_DEFS[b].cardNo)
    .map((character) => ({
      character,
      identity: character === erroroidCharacter ? "ERROROID" : "ANDOROID",
      isOpen: false,
      evidence: 0,
    }));
}

export function findSlot(board: readonly BoardSlot[], character: CharacterId): BoardSlot {
  const slot = board.find((s) => s.character === character);
  if (!slot) {
    throw new Error(`slot not found for character: ${character}`);
  }
  return slot;
}

/** 証拠を加減算する。0未満にはならない。 */
export function addEvidence(
  board: readonly BoardSlot[],
  character: CharacterId,
  amount: number,
): BoardSlot[] {
  return board.map((slot) =>
    slot.character === character
      ? { ...slot, evidence: Math.max(0, slot.evidence + amount) }
      : slot,
  );
}

/** 証拠を絶対値で設定する。0未満にはならない。 */
export function setEvidence(
  board: readonly BoardSlot[],
  character: CharacterId,
  value: number,
): BoardSlot[] {
  return board.map((slot) =>
    slot.character === character ? { ...slot, evidence: Math.max(0, value) } : slot,
  );
}

export function openSlot(board: readonly BoardSlot[], character: CharacterId): BoardSlot[] {
  return board.map((slot) =>
    slot.character === character ? { ...slot, isOpen: true } : slot,
  );
}

/** 証拠がアリバイ以上に達した未オープンカードは強制オープン対象。 */
export function shouldForceOpen(slot: BoardSlot): boolean {
  return !slot.isOpen && slot.evidence >= ANDROID_CARD_DEFS[slot.character].alibi;
}

export function findForceOpenTargets(board: readonly BoardSlot[]): BoardSlot[] {
  return board.filter(shouldForceOpen);
}
