import { DEDUCTION_CARD_DEFS } from "@erroroid/shared";
import { DEDUCTION_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";
import { describeLogEntry } from "./ActionLog";

/**
 * 対応するまで次の行動をブロックする通知モーダル。
 * 相手の操作(カード使用・オープン等)の内容確認と、自分の番が来たことの2種類を、
 * 同じキュー(pendingNotices)から順番に1件ずつ表示する。
 */
export function NoticeModal() {
  const notice = useGameStore((s) => s.pendingNotices[0]);
  const dismissNotice = useGameStore((s) => s.dismissNotice);

  if (!notice) return null;

  return (
    <div className="modal-overlay">
      <div className="modal notice-modal">
        {notice.kind === "turnStart" ? (
          <>
            <h3>あなたの番です</h3>
            <p>行動を選んでください。</p>
          </>
        ) : (
          <>
            <h3>相手の行動</h3>
            <ul className="notice-entry-list">
              {notice.entries.map((entry, i) => (
                <li key={i} className="notice-entry">
                  {entry.kind === "cardPlayed" && (
                    <img
                      src={DEDUCTION_CARD_IMAGES[entry.cardId]}
                      alt={DEDUCTION_CARD_DEFS[entry.cardId].displayName}
                      className="deduction-card-image-large"
                    />
                  )}
                  <p>{describeLogEntry(entry)}</p>
                  {entry.kind === "cardPlayed" && (
                    <p className="card-detail-effect">{DEDUCTION_CARD_DEFS[entry.cardId].effectText}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={dismissNotice}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
