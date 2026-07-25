import type { PlayerTokens } from "@erroroid/shared";

export function TokenTray({ tokens }: { tokens: PlayerTokens }) {
  return (
    <div className="resource-areas">
      <div className="resource-area memory-area">
        <div className="resource-area-label">メモリーエリア</div>
        <div className="resource-area-value">{tokens.memory}</div>
      </div>
      <div className="resource-area used-area">
        <div className="resource-area-label">消費エリア</div>
        <div className="resource-area-value">{tokens.consumption}</div>
      </div>
    </div>
  );
}
