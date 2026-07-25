import { ANDROID_CARD_DEFS, CHARACTER_IDS, type CharacterId } from "@erroroid/shared";
import { useState } from "react";
import { ANDROID_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";

export function Lobby() {
  const lobbyPhase = useGameStore((s) => s.lobbyPhase);
  const perspective = useGameStore((s) => s.perspective);
  const playerCount = useGameStore((s) => s.playerCount);
  const submitErroroidChoice = useGameStore((s) => s.submitErroroidChoice);
  const lastActionError = useGameStore((s) => s.lastActionError);
  const [submitted, setSubmitted] = useState<CharacterId | null>(null);

  if (lobbyPhase === null) {
    return <div className="notice-box">読み込み中…</div>;
  }

  if (lobbyPhase === "waitingForPlayers") {
    return (
      <div className="lobby">
        <h2>プレイヤーの参加を待っています…</h2>
        <p>現在 {playerCount} / 2 人が参加済みです。このURLを友人に共有してください。</p>
        <p className="room-url-box">{window.location.href}</p>
      </div>
    );
  }

  // waitingForErroroidChoices
  if (perspective === "spectator") {
    return (
      <div className="lobby">
        <h2>プレイヤーが犯人(エラーロイド)を選択中です…</h2>
      </div>
    );
  }

  return (
    <div className="lobby">
      <h2>あなたの犯人(エラーロイド)を1体選んでください</h2>
      <p>
        この選択は相手には見えません。選んだキャラクターの裏面だけがエラーロイド(犯人)になります。
        効果は自分の意思でオープンした時(コストを払って発動)にのみ使えます。決定後も相手が選ぶまでは選び直せます。
      </p>
      <div className="character-picker">
        {CHARACTER_IDS.map((character) => {
          const def = ANDROID_CARD_DEFS[character];
          return (
            <button
              key={character}
              className={submitted === character ? "character-card selected" : "character-card"}
              onClick={() => {
                setSubmitted(character);
                submitErroroidChoice(character);
              }}
            >
              <img
                src={ANDROID_CARD_IMAGES[character]}
                alt={def.displayName}
                className="character-card-image"
              />
            </button>
          );
        })}
      </div>
      {submitted && <p>「{ANDROID_CARD_DEFS[submitted].displayName}」を選択しました。相手の選択を待っています…</p>}
      {lastActionError && <p className="error-text">{lastActionError}</p>}
    </div>
  );
}
