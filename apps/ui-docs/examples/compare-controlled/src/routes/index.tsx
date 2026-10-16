// Rivet-authored Compare demo (Rivet addition): a controlled position (two-way Signal) with a readout and preset buttons.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Compare } from "@rivetjs/ui/compare";
import duneImage from "../assets/cover-dune.jpg?image";

export const head = { title: "Compare: Controlled" };

// #region demo
export function CompareControlled() {
  const position = signal(30);
  const ends = signal(0);
  return (
    <div class="flex w-[min(28rem,100%)] flex-col gap-3">
      <Compare value={position} onChangeEnd={() => ends.set(ends() + 1)} class="aspect-[4/3]">
        <Compare.Before>
          <img src={duneImage.src} alt="Sand dunes, desaturated" class="saturate-0" draggable={false} />
        </Compare.Before>
        <Compare.After>
          <img src={duneImage.src} alt="Sand dunes" draggable={false} />
        </Compare.After>
        <Compare.Handle id="compare-controlled-handle" />
      </Compare>
      <div class="flex items-center justify-between gap-2 text-sm">
        <span id="compare-controlled-value" class="tabular-nums">
          Position: {Math.round(position())}%
        </span>
        <span id="compare-controlled-ends" class="text-muted tabular-nums">
          Released: {ends()}×
        </span>
      </div>
      <div class="flex gap-2">
        <Button id="compare-controlled-25" size="sm" variant="secondary" onPress={() => position.set(25)}>
          25%
        </Button>
        <Button id="compare-controlled-50" size="sm" variant="secondary" onPress={() => position.set(50)}>
          50%
        </Button>
        <Button id="compare-controlled-75" size="sm" variant="secondary" onPress={() => position.set(75)}>
          75%
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CompareControlled />
    </div>
  );
}
