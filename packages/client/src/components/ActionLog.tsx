import { ANDROID_CARD_DEFS, type EffectLogEntry } from "@erroroid/shared";
import { useGameStore } from "../store/useGameStore";

function describe(entry: EffectLogEntry): string {
  if (entry.kind === "open") {
    const name = ANDROID_CARD_DEFS[entry.character].displayName;
    const owner = entry.owner === "player1" ? "プレイヤー1" : "プレイヤー2";
    return `${owner}の${name}がオープン(${entry.identity === "ERROROID" ? "ERROROID" : "ANDOROID"})`;
  }
  if (entry.kind === "oliverTriggered") {
    const owner = entry.owner === "player1" ? "プレイヤー1" : "プレイヤー2";
    const opponent = entry.owner === "player1" ? "プレイヤー2" : "プレイヤー1";
    const name = ANDROID_CARD_DEFS.oliver.displayName;
    return `${owner}の${name}の能力が発動(${opponent}の全アンドロイドの証拠+1)`;
  }
  if (entry.question === "isTargetErroroid") {
    const name = entry.targetCharacter ? ANDROID_CARD_DEFS[entry.targetCharacter].displayName : "対象";
    return `${name}はエラーロイドで${entry.answer ? "ある" : "ない"}と判明`;
  }
  return `証拠2以上のアンドロイドの中にエラーロイドが${entry.answer ? "いる" : "いない"}と判明`;
}

export function ActionLog() {
  const actionLog = useGameStore((s) => s.actionLog);

  return (
    <div className="action-log">
      <h4>アクションログ</h4>
      <ul>
        {actionLog
          .slice(-20)
          .reverse()
          .map((entry, i) => (
            <li key={i}>{describe(entry)}</li>
          ))}
      </ul>
    </div>
  );
}
