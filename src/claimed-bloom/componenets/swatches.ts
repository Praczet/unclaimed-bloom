import { bg, fg, type TextChunk } from "@opentui/core";

// Up to `count` colour blocks spread evenly over the given hex values.
export function swatchStrip(hexValues: string[], count: number, width = 2): TextChunk[] {
  if (hexValues.length === 0) return [];
  const step = Math.max(1, Math.floor(hexValues.length / count));
  const chunks: TextChunk[] = [];
  for (let index = 0; index < hexValues.length && chunks.length < count; index += step) {
    chunks.push(bg(hexValues[index]!)(" ".repeat(width)));
  }
  return chunks;
}

// `███░░░░░░░ 30%` for a 0–1 share.
export function shareBar(share: number, color: string, muted: string, width = 10): TextChunk[] {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * width);
  return [
    fg(color)("█".repeat(filled)),
    fg(muted)("░".repeat(width - filled)),
    fg(muted)(` ${Math.round(share * 100)}%`.padEnd(5)),
  ];
}

// ● planted now, ○ part of the current composition but not planting this, blank otherwise.
export function liveMarker(state: "live" | "related" | "none"): string {
  return state === "live" ? "●" : state === "related" ? "○" : " ";
}
