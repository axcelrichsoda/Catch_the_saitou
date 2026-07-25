import { DEDUCTION_CARD_DEFS, type DeductionCardId } from "@erroroid/shared";
import { useState } from "react";
import { DEDUCTION_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";

interface Props {
  hand: readonly DeductionCardId[];
  memory: number;
  myTurn: boolean;
  /** trueの間は「使用する」を無効化する(action応答待ちの多重送信防止)。 */
  disabled?: boolean;
}

export function Hand({ hand, memory, myTurn, disabled }: Props) {
  const playDeductionCard = useGameStore((s) => s.playDeductionCard);
  const [confirmCardId, setConfirmCardId] = useState<DeductionCardId | null>(null);

  const def = confirmCardId ? DEDUCTION_CARD_DEFS[confirmCardId] : null;
  const playable = def ? myTurn && !disabled && memory >= def.cost : false;

  return (
    <>
      <div className="hand">
        {hand.map((cardId, index) => {
          const cardDef = DEDUCTION_CARD_DEFS[cardId];
          const cardPlayable = myTurn && memory >= cardDef.cost;
          return (
            <button
              key={`${cardId}-${index}`}
              type="button"
              className={cardPlayable ? "deduction-card" : "deduction-card not-playable"}
              onClick={() => setConfirmCardId(cardId)}
            >
              <img
                src={DEDUCTION_CARD_IMAGES[cardId]}
                alt={cardDef.displayName}
                className="deduction-card-image"
              />
              <div className="card-name">{cardDef.displayName}</div>
              <div className="card-cost">コスト {cardDef.cost}</div>
              <div className="card-hint">クリックで詳細・使用</div>
            </button>
          );
        })}
      </div>

      {def && (
        <div className="modal-overlay" onClick={() => setConfirmCardId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={DEDUCTION_CARD_IMAGES[confirmCardId!]}
              alt={def.displayName}
              className="deduction-card-image-large"
            />
            <h3>{def.displayName}</h3>
            <p className="card-detail-cost">コスト {def.cost}</p>
            <p className="card-detail-effect">{def.effectText}</p>
            {!playable && (
              <p className="notice-box warning">
                {myTurn ? "メモリーが不足しているため使用できません" : "自分のターンではないため使用できません"}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmCardId(null)}>
                キャンセル
              </button>
              <button
                type="button"
                disabled={!playable}
                onClick={() => {
                  playDeductionCard(confirmCardId!);
                  setConfirmCardId(null);
                }}
              >
                使用する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
