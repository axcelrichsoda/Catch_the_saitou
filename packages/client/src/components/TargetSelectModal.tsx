import { ANDROID_CARD_DEFS, type TargetRef } from "@erroroid/shared";
import { useState } from "react";
import { ANDROID_CARD_IMAGES } from "../assets/cardImages";
import { useGameStore } from "../store/useGameStore";

export function TargetSelectModal() {
  const request = useGameStore((s) => s.pendingTargetsRequest);
  const view = useGameStore((s) => s.view);
  const respond = useGameStore((s) => s.respondChooseTargets);
  const [selected, setSelected] = useState<number[]>([]);

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
