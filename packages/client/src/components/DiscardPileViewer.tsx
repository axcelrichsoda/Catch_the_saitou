import { DEDUCTION_CARD_DEFS, type DeductionCardId } from "@erroroid/shared";
import { useState } from "react";
import { DEDUCTION_CARD_IMAGES } from "../assets/cardImages";

interface Props {
  discardPile: readonly DeductionCardId[];
}

export function DiscardPileViewer({ discardPile }: Props) {
  const [open, setOpen] = useState(false);
  const [detailCardId, setDetailCardId] = useState<DeductionCardId | null>(null);
  const detailDef = detailCardId ? DEDUCTION_CARD_DEFS[detailCardId] : null;

  return (
    <>
      <button type="button" className="discard-pile-link" onClick={() => setOpen(true)}>
        廃棄場 {discardPile.length} 枚(共有)
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>廃棄場({discardPile.length}枚)</h3>
            {discardPile.length === 0 ? (
              <p className="notice-box">まだ廃棄されたカードはありません。</p>
            ) : (
              <div className="target-candidates">
                {discardPile.map((cardId, i) => (
                  <button key={i} type="button" className="deduction-card" onClick={() => setDetailCardId(cardId)}>
                    <img
                      src={DEDUCTION_CARD_IMAGES[cardId]}
                      alt={DEDUCTION_CARD_DEFS[cardId].displayName}
                      className="deduction-card-image"
                    />
                    {DEDUCTION_CARD_DEFS[cardId].displayName}
                  </button>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {detailDef && detailCardId && (
        <div className="modal-overlay" onClick={() => setDetailCardId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={DEDUCTION_CARD_IMAGES[detailCardId]}
              alt={detailDef.displayName}
              className="deduction-card-image-large"
            />
            <h3>{detailDef.displayName}</h3>
            <p className="card-detail-cost">コスト {detailDef.cost}</p>
            <p className="card-detail-effect">{detailDef.effectText}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setDetailCardId(null)}>
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
