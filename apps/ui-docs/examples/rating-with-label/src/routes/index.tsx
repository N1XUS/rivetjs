// Rivet-authored Rating demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: with label" };

// #region demo
export function WithLabel() {
  return (
    <div class="flex flex-col gap-1.5">
      <span id="rt-label" class="text-sm font-medium">
        Delivery speed
      </span>
      <Rating aria-labelledby="rt-label" defaultValue={4} />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithLabel />
    </div>
  );
}
