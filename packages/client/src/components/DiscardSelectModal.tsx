import { DEDUCTION_CARD_DEFS } from "@erroroid/shared";
import { DEDUCTION_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";

export function DiscardSelectModal() {
  const request = useGameStore((s) => s.pendingDiscardRequest);
  const respond = useGameStore((s) => s.respondChooseDiscard);

  if (!request) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>廃棄場から1枚選んでください</h3>
        <div className="target-candidates">
          {request.candidates.map((cardId, i) => (
            <button key={i} type="button" className="deduction-card" onClick={() => respond(cardId)}>
              <img
                src={DEDUCTION_CARD_IMAGES[cardId]}
                alt={DEDUCTION_CARD_DEFS[cardId].displayName}
                className="deduction-card-image"
              />
              {DEDUCTION_CARD_DEFS[cardId].displayName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
