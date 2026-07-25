import type { PlayerId } from "@erroroid/shared";
import type { GameState } from "../../game/GameState.js";
import { lillianRecallInsight } from "./lillian.js";

export type CustomEffectHandler = (state: GameState, actingPlayer: PlayerId) => GameState;

export const CUSTOM_EFFECT_HANDLERS: Readonly<Record<string, CustomEffectHandler>> = {
  lillian_recall_insight: lillianRecallInsight,
};
