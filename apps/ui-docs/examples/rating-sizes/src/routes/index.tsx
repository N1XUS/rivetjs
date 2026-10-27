// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: sizes" };

// #region demo
export function Sizes() {
  return (
    <div id="rt-sizes" class="flex flex-col items-center gap-3">
      <Rating isReadOnly value={4} size="sm" />
      <Rating isReadOnly value={4} size="md" />
      <Rating isReadOnly value={4} size="lg" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}
