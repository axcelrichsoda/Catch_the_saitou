import type { CharacterId } from "../../types/core.js";
import { ben } from "./ben.js";
import { charlotte } from "./charlotte.js";
import { ivy } from "./ivy.js";
import { lillian } from "./lillian.js";
import { lucas } from "./lucas.js";
import { oliver } from "./oliver.js";
import { saint } from "./saint.js";
import type { AndroidCardEffectDef } from "./types.js";

export type { AndroidCardEffectDef } from "./types.js";
export { ben, charlotte, ivy, lillian, lucas, oliver, saint };

export const ANDROID_CARD_EFFECTS: Readonly<Record<CharacterId, AndroidCardEffectDef>> = {
  charlotte,
  lucas,
  ivy,
  ben,
  lillian,
  oliver,
  saint,
};
