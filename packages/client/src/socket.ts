import { io } from "socket.io-client";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:3001";

/** Renderの無料枠スリープ対策。WebSocketのアイドル接続だけでは「アクティブ」扱いされない可能性があるため、
 * 実HTTPリクエストとして数分おきにpingする(サーバー側は index.ts の GET /ping)。 */
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

export const socket = io(SERVER_URL, { autoConnect: true });

export function createRoom(): Promise<{ roomToken: string }> {
  return fetch(`${SERVER_URL}/rooms`, { method: "POST" }).then((res) => res.json());
}

/** アプリ起動時に一度だけ呼び出す。シンキングタイムが長時間に及んでもサーバーをスリープさせないための心拍ping。 */
export function startHeartbeat(): void {
  setInterval(() => {
    fetch(`${SERVER_URL}/ping`).catch(() => {
      // 一時的な切断・スリープ中の失敗は次回の間隔で再試行されるため無視してよい。
    });
  }, HEARTBEAT_INTERVAL_MS);
}
