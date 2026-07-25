import { ANDROID_CARD_DEFS, type MaskedBoardSlot } from "@erroroid/shared";
import { useState } from "react";
import { ANDROID_BACK_IMAGES, ANDROID_CARD_IMAGES } from "../assets/cardImages";

interface Props {
  board: readonly MaskedBoardSlot[];
  onSelectCharacter?: (character: MaskedBoardSlot["character"]) => void;
  selectable?: (slot: MaskedBoardSlot) => boolean;
  /** 自分の現在メモリー数。渡された場合、コスト不足で選べないカードにその旨を表示する。 */
  memory?: number;
}

/** 証拠/アリバイの割合。証拠が積み上がるほど増えていき、100%で強制オープン。 */
function evidenceRatio(evidence: number, alibi: number): number {
  return alibi > 0 ? Math.min(1, evidence / alibi) : 0;
}

/** 証拠がアリバイに迫るほど危険度を色で示す(強制オープンまでの余裕を一目で分かるように)。 */
function hpBarColor(evidence: number, alibi: number): string {
  const ratio = alibi > 0 ? evidence / alibi : 0;
  if (ratio >= 1) return "var(--danger)";
  if (ratio >= 0.5) return "var(--warning)";
  return "var(--accent)";
}

export function AndroidRow({ board, onSelectCharacter, selectable, memory }: Props) {
  const [confirmCharacter, setConfirmCharacter] = useState<MaskedBoardSlot["character"] | null>(null);
  const confirmSlot = board.find((s) => s.character === confirmCharacter);
  const confirmDef = confirmSlot ? ANDROID_CARD_DEFS[confirmSlot.character] : null;

  return (
    <div className="android-row">
      {board.map((slot) => {
        const def = ANDROID_CARD_DEFS[slot.character];
        // オリバーは自分のターン中に自発オープンしても効果が一切発動しない
        // (相手ターン中に証拠が丁度4に到達した瞬間のみ自動発動する常在トリガー専用のカードのため)。
        // コスト0で常に選択可能に見えてしまうと「押せるのに無意味」な罠になるため、手動選択の対象から外す。
        const isOliver = slot.character === "oliver";
        const canSelect = Boolean(onSelectCharacter && !isOliver && selectable?.(slot));
        const showInsufficientHint =
          Boolean(onSelectCharacter) &&
          !isOliver &&
          !slot.isOpen &&
          !canSelect &&
          memory !== undefined &&
          memory < def.cost;
        const classNames = [
          "android-slot",
          slot.isOpen ? "open" : "closed",
          slot.identity === "ERROROID" ? "erroroid" : slot.identity === "ANDOROID" ? "androoid" : "unknown",
          canSelect ? "selectable" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={slot.character}
            type="button"
            className={classNames}
            disabled={!canSelect}
            onClick={() => canSelect && setConfirmCharacter(slot.character)}
          >
            {slot.isOpen && slot.identity ? (
              <img
                src={ANDROID_BACK_IMAGES[slot.identity]}
                alt={slot.identity === "ERROROID" ? "ERROROID" : "ANDOROID"}
                className="android-card-image"
              />
            ) : (
              <img
                src={ANDROID_CARD_IMAGES[slot.character]}
                alt={def.displayName}
                className="android-card-image"
              />
            )}
            <div className="hp-bar-track">
              <div
                className="hp-bar-fill"
                style={{
                  width: `${evidenceRatio(slot.evidence, def.alibi) * 100}%`,
                  backgroundColor: hpBarColor(slot.evidence, def.alibi),
                }}
              />
            </div>
            <div className="android-evidence">
              証拠 {slot.evidence} / アリバイ {def.alibi}
            </div>
            {slot.isOpen ? (
              <div className="android-identity">{slot.identity === "ERROROID" ? "ERROROID(犯人)" : "ANDOROID"}</div>
            ) : (
              <>
                <div className="android-hidden">未オープン</div>
                {isOliver && (
                  <div className="android-auto-hint">相手ターン中に証拠が4に到達すると自動でオープンします</div>
                )}
                {showInsufficientHint && <div className="android-disabled-hint">メモリー不足</div>}
              </>
            )}
          </button>
        );
      })}

      {confirmSlot && confirmDef && (
        <div className="modal-overlay" onClick={() => setConfirmCharacter(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={ANDROID_CARD_IMAGES[confirmSlot.character]}
              alt={confirmDef.displayName}
              className="deduction-card-image-large"
            />
            <h3>{confirmDef.displayName}</h3>
            <p className="card-detail-cost">コスト {confirmDef.cost}</p>
            <div className="hp-bar-track">
              <div
                className="hp-bar-fill"
                style={{
                  width: `${evidenceRatio(confirmSlot.evidence, confirmDef.alibi) * 100}%`,
                  backgroundColor: hpBarColor(confirmSlot.evidence, confirmDef.alibi),
                }}
              />
            </div>
            <p className="card-detail-cost">
              証拠 {confirmSlot.evidence} / アリバイ {confirmDef.alibi}
            </p>
            <p className="card-detail-effect">{confirmDef.effectText}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmCharacter(null)}>
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCharacter!(confirmSlot.character);
                  setConfirmCharacter(null);
                }}
              >
                使用する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
