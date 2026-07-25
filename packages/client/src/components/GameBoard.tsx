import { ANDROID_CARD_DEFS, type MaskedBoardSlot } from "@erroroid/shared";
import { DEDUCTION_CARD_BACK_IMAGE } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";
import { ActionLog } from "./ActionLog";
import { AndroidRow } from "./AndroidRow";
import { DiscardSelectModal } from "./DiscardSelectModal";
import { Hand } from "./Hand";
import { RevealArea } from "./RevealArea";
import { TargetSelectModal } from "./TargetSelectModal";
import { TokenTray } from "./TokenTray";

function phaseLabel(phase: string): string {
  switch (phase) {
    case "draw":
      return "ドロー";
    case "install":
      return "インストール";
    case "thinking":
      return "シンキングタイム";
    case "gameOver":
      return "ゲーム終了";
    default:
      return phase;
  }
}

export function GameBoard() {
  const view = useGameStore((s) => s.view);
  const perspective = useGameStore((s) => s.perspective);
  const openAndroid = useGameStore((s) => s.openAndroid);
  const useReveal = useGameStore((s) => s.useReveal);
  const endTurn = useGameStore((s) => s.endTurn);
  const lastActionError = useGameStore((s) => s.lastActionError);
  const oliverNotice = useGameStore((s) => s.oliverNotice);
  const dismissOliverNotice = useGameStore((s) => s.dismissOliverNotice);
  const actionInFlight = useGameStore((s) => s.actionInFlight);

  if (!view) {
    return <div className="notice-box">対戦データを読み込み中…</div>;
  }

  const isPlayer = perspective === "player1" || perspective === "player2";
  const myTurn = isPlayer && view.turn === perspective && view.phase === "thinking";
  const me = perspective === "player1" ? view.player1 : perspective === "player2" ? view.player2 : undefined;

  const winnerLabel =
    view.winner === "player1" ? "プレイヤー1" : view.winner === "player2" ? "プレイヤー2" : undefined;

  // 相手を上・自分を下に表示する(実物のプレイマットで対面の相手が奥、自分が手前に来る配置に合わせる)。
  const sections: Array<{ label: string; owner: "player1" | "player2"; isSelf: boolean }> =
    perspective === "spectator"
      ? [
          { label: "プレイヤー1", owner: "player1", isSelf: false },
          { label: "プレイヤー2", owner: "player2", isSelf: false },
        ]
      : perspective === "player1"
        ? [
            { label: "相手", owner: "player2", isSelf: false },
            { label: "自分", owner: "player1", isSelf: true },
          ]
        : [
            { label: "相手", owner: "player1", isSelf: false },
            { label: "自分", owner: "player2", isSelf: true },
          ];

  return (
    <div className="game-layout">
      <aside className="rules-panel">
        <h4>ルール早見表</h4>
        <ul>
          <li>証拠がアリバイ以上になると自動でオープン(強制オープン)</li>
          <li>メモリーエリア: 使用可能な推理力。消費エリア: 使用中(ターン終了で全てメモリーに戻る)</li>
          <li>自分の場の未オープンアンドロイドはコストを払って自発的にオープンできる({ANDROID_CARD_DEFS.oliver.displayName}を除く)</li>
          <li>リヴィールカードは相手の場のアンドロイドを強制オープンする。使用後は二度と使用不可</li>
          <li>{ANDROID_CARD_DEFS.oliver.displayName}だけ例外: 相手ターン中に証拠が丁度4に到達すると自動でオープンし、相手の全アンドロイド証拠+1</li>
          <li>手札のカードはクリックで詳細確認→「使用する」で確定</li>
        </ul>
      </aside>

      <div className="game-board">
        {view.phase === "gameOver" && (
          <div className="notice-box winner-banner">
            {view.winner === perspective ? "あなたの勝利です!" : winnerLabel ? `${winnerLabel}の勝利です` : "ゲーム終了"}
          </div>
        )}

        <div className="turn-indicator">
          手番: {view.turn === "player1" ? "プレイヤー1" : "プレイヤー2"} / フェーズ: {phaseLabel(view.phase)}
          {myTurn && <span className="my-turn-badge">あなたの番です</span>}
        </div>

        <p className="shared-deck-info">
          山札 {view.deck.drawCount} 枚 ・ 廃棄場 {view.deck.discardPile.length} 枚(共有)
        </p>

        {lastActionError && <div className="notice-box error">{lastActionError}</div>}

        {sections.map(({ label, owner, isSelf }) => {
          const data = view[owner];
          return (
            <section key={owner} className={isSelf ? "board-section self" : "board-section opponent"}>
              <h3>{label}</h3>
              <AndroidRow
                board={data.board}
                onSelectCharacter={isSelf ? (character) => openAndroid(character) : undefined}
                selectable={(slot: MaskedBoardSlot) =>
                  isSelf &&
                  myTurn &&
                  !actionInFlight &&
                  !slot.isOpen &&
                  (me?.tokens.memory ?? 0) >= ANDROID_CARD_DEFS[slot.character].cost
                }
                memory={isSelf ? data.tokens.memory : undefined}
              />
              <div className="resource-row">
                <TokenTray tokens={data.tokens} />
                <RevealArea
                  revealCardId={data.revealCardId}
                  available={data.revealCardAvailable}
                  openedCount={data.board.filter((s) => s.isOpen).length}
                  isSelf={isSelf}
                  myTurn={myTurn}
                  memory={data.tokens.memory}
                  onUse={isSelf ? useReveal : undefined}
                  disabled={actionInFlight}
                />
              </div>
              {isSelf && me && (
                <Hand hand={data.hand ?? []} memory={me.tokens.memory} myTurn={myTurn} disabled={actionInFlight} />
              )}
              {!isSelf && (
                <div className="hand-back-row" aria-label={`手札 ${data.handCount} 枚`}>
                  {Array.from({ length: data.handCount }).map((_, i) => (
                    <img key={i} src={DEDUCTION_CARD_BACK_IMAGE} alt="" className="hand-back-image" />
                  ))}
                  <p className="hand-count">手札 {data.handCount} 枚</p>
                </div>
              )}
            </section>
          );
        })}

        {isPlayer && (
          <div className="action-bar">
            <button type="button" disabled={!myTurn || actionInFlight} onClick={endTurn}>
              ターン終了
            </button>
          </div>
        )}

        <ActionLog />
        <TargetSelectModal />
        <DiscardSelectModal />
      </div>

      {oliverNotice && (
        <div className="modal-overlay">
          <div className="modal oliver-notice-modal">
            <h3>{ANDROID_CARD_DEFS.oliver.displayName}の能力が発動しました</h3>
            <p>
              {oliverNotice === "player1" ? "プレイヤー1" : "プレイヤー2"}
              の{ANDROID_CARD_DEFS.oliver.displayName}の証拠が相手ターン中に丁度4まで到達し、自動的にオープンしました。
              その効果で{oliverNotice === "player1" ? "プレイヤー2" : "プレイヤー1"}の全アンドロイドの証拠が+1されています。
            </p>
            <button type="button" onClick={dismissOliverNotice}>
              確認しました
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
