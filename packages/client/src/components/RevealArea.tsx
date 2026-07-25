import { computeRevealCost, REVEAL_CARD_DEFS, type RevealCardId } from "@erroroid/shared";
import { REVEAL_CARD_IMAGES } from "../assets/cardImages";

interface Props {
  revealCardId: RevealCardId;
  available: boolean;
  openedCount: number;
  isSelf: boolean;
  myTurn: boolean;
  memory: number;
  onUse?: () => void;
  /** trueの間は「使用する」を無効化する(action応答待ちの多重送信防止)。 */
  disabled?: boolean;
}

export function RevealArea({ revealCardId, available, openedCount, isSelf, myTurn, memory, onUse, disabled }: Props) {
  const def = REVEAL_CARD_DEFS[revealCardId];
  const cost = computeRevealCost(def, openedCount);
  const canUse = isSelf && myTurn && !disabled && available && memory >= cost;

  return (
    <div className={available ? "resource-area reveal-area" : "resource-area reveal-area used"}>
      <div className="resource-area-label">リヴィールエリア</div>
      {available ? (
        <>
          <img
            src={REVEAL_CARD_IMAGES[revealCardId]}
            alt={def.displayName}
            className="reveal-card-image"
          />
          <div className="reveal-cost">現在のコスト {cost}</div>
          {isSelf && onUse && (
            <button type="button" disabled={!canUse} onClick={onUse}>
              使用する
            </button>
          )}
        </>
      ) : (
        <div className="reveal-used-label">使用済み(裏向き)</div>
      )}
    </div>
  );
}
