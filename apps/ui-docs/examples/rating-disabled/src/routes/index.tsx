// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: disabled" };

// #region demo
export function Disabled() {
  return <Rating id="rt-disabled" defaultValue={2} isDisabled aria-label="Rating" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Disabled />
    </div>
  );
}
