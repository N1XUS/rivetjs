// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: Usage" };

// #region demo
export function Basic() {
  const stars = signal(4);
  return (
    <div class="flex flex-col items-center gap-2">
      <Rating id="rating-basic" value={stars} aria-label="Rate your stay" name="stay" />
      <p class="text-sm text-muted">
        You rated it{" "}
        <span id="rating-basic-value" class="font-medium text-foreground">
          {stars()}
        </span>{" "}
        out of 5
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
