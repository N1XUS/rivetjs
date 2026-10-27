// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: controlled" };

// #region demo
export function Controlled() {
  const value = signal(3);
  return (
    <div class="flex flex-col items-center gap-2">
      <Rating id="rt-controlled" value={value} aria-label="Your rating" />
      <p id="rt-controlled-value" class="text-sm text-muted">
        {value()} of 5
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Controlled />
    </div>
  );
}
