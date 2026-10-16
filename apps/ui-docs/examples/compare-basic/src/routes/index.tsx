// Rivet-authored Compare demo (Rivet addition, no HeroUI counterpart): the same photo in grayscale and in colour.
import { Compare } from "@rivetjs/ui/compare";
import robotImage from "../assets/robot-face.jpg?image";

export const head = { title: "Compare: Usage" };

// #region demo
export function CompareBasic() {
  return (
    <Compare id="compare-basic" class="aspect-video w-[min(36rem,100%)]">
      <Compare.Before>
        <img src={robotImage.src} alt="Knitted robot head, grayscale" class="grayscale" draggable={false} />
        <Compare.Label placement="start">Before</Compare.Label>
      </Compare.Before>
      <Compare.After>
        <img src={robotImage.src} alt="Knitted robot head, colour" draggable={false} />
        <Compare.Label placement="end">After</Compare.Label>
      </Compare.After>
      <Compare.Handle id="compare-basic-handle" aria-label="Reveal the colour photo" />
    </Compare>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CompareBasic />
    </div>
  );
}
