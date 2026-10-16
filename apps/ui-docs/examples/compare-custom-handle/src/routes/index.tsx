// Rivet-authored Compare demo (Rivet addition): custom handle children (accent divider + pill grip) and dragAnywhere.
import { Icon } from "@rivetjs/kit/icon";
import { Compare } from "@rivetjs/ui/compare";
import { MoveHorizontal } from "lucide";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Compare: Custom Handle" };

// #region demo
export function CompareCustomHandle() {
  return (
    <Compare dragAnywhere class="aspect-[4/3] w-[min(32rem,100%)] [--compare-divider-color:var(--accent)] [--compare-divider-width:3px]">
      <Compare.Before>
        <img src={tideImage.src} alt="Calm teal bands, inverted" class="invert" draggable={false} />
      </Compare.Before>
      <Compare.After>
        <img src={tideImage.src} alt="Calm teal bands" draggable={false} />
      </Compare.After>
      <Compare.Handle id="compare-custom-handle" aria-label="Inverted versus original">
        <Compare.Divider />
        <Compare.Thumb class="h-7 w-14 bg-accent text-accent-foreground [&_svg]:text-accent-foreground">
          <Icon icon={MoveHorizontal} size={18} />
        </Compare.Thumb>
      </Compare.Handle>
    </Compare>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CompareCustomHandle />
    </div>
  );
}
