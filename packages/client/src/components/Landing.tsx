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
      <h1>齋藤を捕まえろ</h1>
      <p className="landing-story">
        近未来、世界では仕事用アンドロイドが普及していた。
        <br />
        N社でも、人材不足解消の為、新たに雇入れたが、
        <br />
        ある日殺人事件が発生。
        <br />
        犯行は人間に逆らうアンドロイドで容疑者は7人まで絞られた。
        <br />
        貴方は現場の近くにいた為、疑われています。
        <br />
        犯人(対戦相手)も処分を逃れようと必死に罪をなすりつけようとするので
        <br />
        捕まる前に真犯人を探して、処分を逃れよう!
      </p>
      <p className="landing-win-condition">勝利条件: 相手の悪い人を先にオープンする</p>
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
