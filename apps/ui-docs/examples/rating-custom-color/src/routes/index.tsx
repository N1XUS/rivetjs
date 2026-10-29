// Rivet-authored Rating demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: custom color" };

// #region demo
export function CustomColor() {
  return (
    <div id="rt-colors" class="flex flex-col items-center gap-3">
      <Rating isReadOnly value={3.5} class="[--rating-color:var(--accent)]" />
      <Rating isReadOnly value={4} class="[--rating-color:var(--success)] [--rating-empty:var(--success-soft)]" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomColor />
    </div>
  );
}
