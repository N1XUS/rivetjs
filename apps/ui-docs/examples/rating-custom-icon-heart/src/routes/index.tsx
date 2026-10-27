// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Rating } from "@rivetjs/ui/rating";
import { Heart as HeartIcon } from "lucide";

export const head = { title: "Rating: heart icon" };

// #region demo
export function Heart() {
  return <Rating id="rt-heart" defaultValue={4} icon={HeartIcon} class="[--rating-color:var(--danger)]" aria-label="How much do you like it" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Heart />
    </div>
  );
}
