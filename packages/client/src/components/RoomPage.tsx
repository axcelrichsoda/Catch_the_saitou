import { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { GameBoard } from "./GameBoard";
import { Lobby } from "./Lobby";

export function RoomPage({ roomToken }: { roomToken: string }) {
  const joinRoom = useGameStore((s) => s.joinRoom);
  const lobbyPhase = useGameStore((s) => s.lobbyPhase);
  const joinError = useGameStore((s) => s.joinError);
  const joinNotice = useGameStore((s) => s.joinNotice);
  const connected = useGameStore((s) => s.connected);

  // React StrictMode(開発モード)はeffectを意図的に2回実行するため、
  // refで二重join送信をガードする(同一ソケットからの重複joinはサーバー側でも冪等化済みだが、
  // 無駄な往復とsessionStorage書き込みの競合を避けるためクライアント側でも防ぐ)。
  const joinedRoomToken = useRef<string | null>(null);
  useEffect(() => {
    if (joinedRoomToken.current === roomToken) return;
    joinedRoomToken.current = roomToken;
    joinRoom(roomToken);
  }, [joinRoom, roomToken]);

  if (joinError === "room_not_found") {
    return <div className="notice-box error">このルームは見つかりませんでした。URLを確認してください。</div>;
  }
  if (joinError === "room_full") {
    return <div className="notice-box error">このルームは満員です(プレイヤー2人+観戦者2人まで)。</div>;
  }

  return (
    <div className="room-page">
      {!connected && <div className="notice-box">サーバーに接続中…</div>}
      {joinNotice && <div className="notice-box warning">{joinNotice}</div>}
      {lobbyPhase === "inGame" ? <GameBoard /> : <Lobby />}
    </div>
  );
}
