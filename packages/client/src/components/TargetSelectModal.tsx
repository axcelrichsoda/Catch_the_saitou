import {
  ANDROID_CARD_DEFS,
  DEDUCTION_CARD_DEFS,
  REVEAL_CARD_DEFS,
  type EffectSource,
  type TargetRef,
} from "@erroroid/shared";
import { useEffect, useState } from "react";
import { ANDROID_CARD_IMAGES, DEDUCTION_CARD_IMAGES, REVEAL_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";

interface SourceCardInfo {
  readonly name: string;
  readonly image: string;
  readonly effectText?: string;
}

function sourceCardInfo(source: EffectSource | undefined): SourceCardInfo | null {
  if (!source) return null;
  if (source.kind === "deductionCard") {
    const def = DEDUCTION_CARD_DEFS[source.cardId];
    return { name: def.displayName, image: DEDUCTION_CARD_IMAGES[source.cardId], effectText: def.effectText };
  }
  if (source.kind === "androidCard") {
    const def = ANDROID_CARD_DEFS[source.character];
    return { name: def.displayName, image: ANDROID_CARD_IMAGES[source.character], effectText: def.effectText };
  }
  const def = REVEAL_CARD_DEFS[source.revealCardId];
  return { name: def.displayName, image: REVEAL_CARD_IMAGES[source.revealCardId] };
}

export function TargetSelectModal() {
  const request = useGameStore((s) => s.pendingTargetsRequest);
  const view = useGameStore((s) => s.view);
  const respond = useGameStore((s) => s.respondChooseTargets);
  const [selected, setSelected] = useState<number[]>([]);
  // 新しい選択リクエストが来るたびに、まずどのカードの効果かを見せてから対象選択に進む。
  const [contextAcknowledged, setContextAcknowledged] = useState(false);

  useEffect(() => {
    setSelected([]);
    setContextAcknowledged(false);
  }, [request?.requestId]);

  if (!request) return null;

  // 証拠は常に公開情報(view上でマスクされない)なので、現在の盤面から素引きするだけで良い。
  function currentEvidence(candidate: TargetRef): number | undefined {
    return view?.[candidate.owner].board.find((slot) => slot.character === candidate.character)?.evidence;
  }

  function toggle(index: number) {
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= request!.count) return prev;
      return [...prev, index];
    });
  }

  function confirm() {
    respond(selected.map((i) => request!.candidates[i]!));
    setSelected([]);
  }

  const info = sourceCardInfo(request.source);
  if (info && !contextAcknowledged) {
    return (
      <div className="modal-overlay">
        <div className="modal notice-modal">
          <h3>対象選択が必要です</h3>
          <img src={info.image} alt={info.name} className="deduction-card-image-large" />
          <p>{info.name}</p>
          {info.effectText && <p className="card-detail-effect">{info.effectText}</p>}
          <div className="modal-actions">
            <button type="button" onClick={() => setContextAcknowledged(true)}>
              選択へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>対象を{request.count}体選択してください</h3>
        <div className="target-candidates">
          {request.candidates.map((candidate, i) => {
            const def = ANDROID_CARD_DEFS[candidate.character];
            const evidence = currentEvidence(candidate);
            return (
              <button
                key={i}
                type="button"
                className={selected.includes(i) ? "target-candidate selected" : "target-candidate"}
                onClick={() => toggle(i)}
              >
                <img
                  src={ANDROID_CARD_IMAGES[candidate.character]}
                  alt={def.displayName}
                  className="target-candidate-image"
                />
                {def.displayName}
                <span className="target-owner">{candidate.owner === "player1" ? "P1" : "P2"}</span>
                {evidence !== undefined && (
                  <span className="target-evidence">
                    証拠 {evidence} / アリバイ {def.alibi}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" disabled={selected.length !== request.count} onClick={confirm}>
          決定
        </button>
      </div>
    </div>
  );
}
