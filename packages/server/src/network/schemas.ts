import { CHARACTER_IDS, DEDUCTION_CARD_IDS } from "@erroroid/shared";
import { z } from "zod";

/**
 * ソケット経由で受け取るペイロードの形状検証。
 * インターネットに公開されるルームURLへ任意の形のメッセージが送られてくる前提で、
 * 不正な形のペイロードはここで弾いてから先の処理(GameEngine等)へ渡す。
 */

const playerIdSchema = z.enum(["player1", "player2"]);
const characterIdSchema = z.enum(CHARACTER_IDS);
const deductionCardIdSchema = z.enum(DEDUCTION_CARD_IDS);

export const joinRequestSchema = z.object({
  roomToken: z.string().min(1),
  sessionToken: z.string().min(1).optional(),
});

export const submitErroroidChoiceRequestSchema = z.object({
  character: characterIdSchema,
});

const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("playDeductionCard"), player: playerIdSchema, cardId: deductionCardIdSchema }),
  z.object({ type: z.literal("openAndroid"), player: playerIdSchema, character: characterIdSchema }),
  z.object({ type: z.literal("useReveal"), player: playerIdSchema }),
  z.object({ type: z.literal("endTurn"), player: playerIdSchema }),
]);

export const actionRequestSchema = z.object({
  action: gameActionSchema,
});

const targetRefSchema = z.object({
  owner: playerIdSchema,
  character: characterIdSchema,
});

export const chooseTargetsResponseSchema = z.object({
  requestId: z.string().min(1),
  chosen: z.array(targetRefSchema),
});

export const chooseDiscardResponseSchema = z.object({
  requestId: z.string().min(1),
  picked: deductionCardIdSchema,
});
