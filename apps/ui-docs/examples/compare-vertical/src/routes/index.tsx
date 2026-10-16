// Rivet-authored Compare demo (Rivet addition): a vertical comparison of a flat and a graded photo.
import { Compare } from "@rivetjs/ui/compare";
import pineImage from "../assets/cover-pine.jpg?image";

export const head = { title: "Compare: Vertical" };

// #region demo
export function CompareVertical() {
  return (
    <Compare id="compare-vertical" orientation="vertical" defaultValue={40} class="aspect-square w-[min(24rem,100%)]">
      <Compare.Before>
        <img src={pineImage.src} alt="Pine forest, flat colours" class="contrast-75 saturate-50" draggable={false} />
        <Compare.Label placement="start">Flat</Compare.Label>
      </Compare.Before>
      <Compare.After>
        <img src={pineImage.src} alt="Pine forest, graded" draggable={false} />
        <Compare.Label placement="end">Graded</Compare.Label>
      </Compare.After>
      <Compare.Handle id="compare-vertical-handle" />
    </Compare>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CompareVertical />
    </div>
  );
}
