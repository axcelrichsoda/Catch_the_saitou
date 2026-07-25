import { randomUUID } from "node:crypto";
import { Room } from "./Room.js";

/** ルームトークン(推測困難なランダムURL)をキーにRoomインスタンスを保持するレジストリ。 */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  createRoom(): Room {
    const token = randomUUID();
    const room = new Room(token, undefined, this.rng);
    this.rooms.set(token, room);
    return room;
  }

  get(token: string): Room | undefined {
    return this.rooms.get(token);
  }
}
