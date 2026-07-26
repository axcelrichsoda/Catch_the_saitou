import { ANDROID_CARD_DEFS, DEDUCTION_CARD_DEFS, DEDUCTION_DECK_SIZE, type MaskedBoardSlot } from "@erroroid/shared";
import { DEDUCTION_CARD_BACK_IMAGE } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";
import { ActionLog } from "./ActionLog";
import { AndroidRow } from "./AndroidRow";
import { DiscardPileViewer } from "./DiscardPileViewer";
import { DiscardSelectModal } from "./DiscardSelectModal";
import { Hand } from "./Hand";
import { NoticeModal } from "./NoticeModal";
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
  const pendingNotices = useGameStore((s) => s.pendingNotices);
  const actionInFlight = useGameStore((s) => s.actionInFlight);

  if (!view) {
    return <div className="notice-box">対戦データを読み込み中…</div>;
  }

  const isPlayer = perspective === "player1" || perspective === "player2";
  const myTurn = isPlayer && view.turn === perspective && view.phase === "thinking";
  // 未確認の通知(相手の行動内容・自分の番になった通知)がある間は行動をブロックし、
  // OKを押して確認してから次の行動に進んでもらう。
  const canAct = myTurn && pendingNotices.length === 0 && !actionInFlight;
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
        <h4>カードの見方</h4>
        <ul>
          <li>左上の数字: メモリー消費コスト</li>
          <li>キャラカード: 証拠とアリバイを持つカードのこと。証拠がアリバイを上回ると、そのカードがアンドロイドかエラーロイドかが判明してしまう</li>
          <li>証拠: 現在のダメージ蓄積量。最低値は0</li>
          <li>アリバイ: HP</li>
          <li>メモリーエリア: いわゆるTCGのマナ概念。毎ターン自動で全回復し既存値+1の値になる。これを消費してカードをプレイする</li>
          <li>リヴィールエリア: 切り札的存在。判明している自身のアンドロイドカードの枚数分だけコストが安くなる。相手の場のアンドロイドを強制オープンする効果で、使用後は二度と使用不可</li>
          <li>廃棄場: お互いのプレイヤーが手札の推理カードを使用後、捨て札となる場所</li>
          <li>
            おまけ: 盤面のキャラカードはコストを払うことで使うこともできる({ANDROID_CARD_DEFS.oliver.displayName}を除く)。ただしその瞬間アンドロイド/エラーロイドが判明するのでタイミングが大事
          </li>
        </ul>
        <h4>ルール早見表</h4>
        <ul>
          <li>消費エリア: メモリーから支払ったコストが一時的に移る場所。ターン終了で全てメモリーに戻る</li>
          <li>{ANDROID_CARD_DEFS.oliver.displayName}だけ例外: 相手ターン中に証拠が丁度4に到達すると自動でオープンし、相手の全アンドロイド証拠+1</li>
          <li>手札のカードはクリックで詳細確認→「使用する」で確定</li>
        </ul>
        <h4>推理カード内訳(山札40枚共通)</h4>
        <ul>
          {Object.values(DEDUCTION_CARD_DEFS).map((def) => (
            <li key={def.id}>
              {def.displayName} × {def.count}
            </li>
          ))}
          <li>合計 {DEDUCTION_DECK_SIZE} 枚</li>
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

        <div className="shared-deck-info">
          山札 {view.deck.drawCount} 枚 ・ <DiscardPileViewer discardPile={view.deck.discardPile} />
        </div>

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
                  isSelf && canAct && !slot.isOpen && (me?.tokens.memory ?? 0) >= ANDROID_CARD_DEFS[slot.character].cost
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
                  myTurn={canAct}
                  memory={data.tokens.memory}
                  onUse={isSelf ? useReveal : undefined}
                  disabled={actionInFlight}
                />
              </div>
              {isSelf && me && (
                <Hand hand={data.hand ?? []} memory={me.tokens.memory} myTurn={canAct} disabled={actionInFlight} />
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
            <button type="button" disabled={!canAct} onClick={endTurn}>
              ターン終了
            </button>
          </div>
        )}

        <ActionLog />
        <TargetSelectModal />
        <DiscardSelectModal />
      </div>

      <NoticeModal />
    </div>
  );
}
