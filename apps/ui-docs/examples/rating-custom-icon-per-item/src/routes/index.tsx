// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Rating } from "@rivetjs/ui/rating";
import { Angry, Frown, Laugh, Meh, Smile } from "lucide";

export const head = { title: "Rating: an icon per value" };

// #region demo
const MOODS = [Angry, Frown, Meh, Smile, Laugh];

export function Mood() {
  return <Rating id="rt-mood" defaultValue={4} icon={(value) => MOODS[value - 1]} aria-label="How was your day" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Mood />
    </div>
  );
}
