import { useState } from "react";
import { createRoom } from "../socket";

export function Landing() {
  const [creating, setCreating] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setCreating(true);
    setError(null);
    try {
      const { roomToken } = await createRoom();
      const url = `${window.location.origin}/room/${roomToken}`;
      setRoomUrl(url);
    } catch {
      setError("ルームの作成に失敗しました。サーバーが起動しているか確認してください。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="landing">
      <h1>エラーロイド</h1>
      <p>2人用の正体隠匿推理カードゲーム。ルームを作成して、友人にURLを共有してください。</p>
      <button onClick={handleCreateRoom} disabled={creating}>
        {creating ? "作成中…" : "新しいルームを作成"}
      </button>
      {error && <p className="error-text">{error}</p>}
      {roomUrl && (
        <div className="room-url-box">
          <p>このURLを友人と自分で開いてください(最初の2人がプレイヤー、続く2人までは観戦者になります):</p>
          <a href={roomUrl}>{roomUrl}</a>
        </div>
      )}
    </div>
  );
}
