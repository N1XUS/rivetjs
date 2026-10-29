// Rivet-authored Rating demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: Read only" };

// #region demo
export function ReadOnly() {
  return (
    <div class="flex flex-col items-start gap-4">
      <Rating id="rating-ro-sm" value={3.2} isReadOnly showValue size="sm" />
      <Rating id="rating-ro-md" value={4.6} isReadOnly showValue />
      <div class="flex items-center gap-2">
        <Rating id="rating-ro-lg" value={4.8} isReadOnly size="lg" />
        <span class="text-sm text-muted">1,284 reviews</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ReadOnly />
    </div>
  );
}
