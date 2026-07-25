import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { RoomRegistry } from "./network/RoomRegistry.js";
import { registerSocketHandlers } from "./network/SocketHandlers.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

const registry = new RoomRegistry();
registerSocketHandlers(io, registry);

/**
 * Renderの無料枠スリープ対策のハートビート用エンドポイント。
 * クライアントから数分おきに実HTTPリクエストとして叩かれる想定(WebSocketフレームだけでは不十分)。
 */
app.get("/ping", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/", (_req, res) => {
  res.status(200).json({ name: "erroroid-server", status: "ok" });
});

/** トップページから誰でも新規ルームを作れる(推測困難なランダムトークン付きURL)。 */
app.post("/rooms", (_req, res) => {
  const room = registry.createRoom();
  res.status(201).json({ roomToken: room.token });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`erroroid server listening on port ${PORT}`);
});
