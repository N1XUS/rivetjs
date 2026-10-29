// Rivet-authored Rating demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: fractional read-only" };

// #region demo
export function Fractional() {
  return (
    <div id="rt-fraction" class="flex flex-col items-center gap-3">
      <Rating isReadOnly value={4.3} showValue />
      <Rating isReadOnly value={2.75} showValue />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Fractional />
    </div>
  );
}
