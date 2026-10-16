// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/scroll-shadow/visibility-change.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";
import type { ScrollShadowVisibility } from "@rivetjs/ui/scroll-shadow";
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
import avocadoImage from "../assets/avocado.jpg?image";
import orangesImage from "../assets/oranges.jpg?image";
import robotImage from "../assets/robot.jpg?image";

export const head = { title: "ScrollShadow: Visibility Change" };

// #region demo
const images = [robotImage.src, avocadoImage.src, orangesImage.src];

const getRandomImage = (idx: number) => images[idx % images.length];

export function VisibilityChange() {
  const verticalState = signal<ScrollShadowVisibility>("none");
  const horizontalState = signal<ScrollShadowVisibility>("none");

  return (
    <div class="w-full sm:max-w-sm">
      <div class="mb-8 flex flex-col gap-2">
        <div class="rounded bg-default p-4">
          <p class="text-sm font-semibold">
            Vertical Shadow State: <span id="vertical-state">{verticalState()}</span>
          </p>
        </div>
        <div class="w-full">
          <ScrollShadow
            id="vertical"
            class="max-h-[240px] p-4"
            orientation="vertical"
            onVisibilityChange={(visibility: ScrollShadowVisibility) => verticalState.set(visibility)}
          >
            <div class="space-y-4">
              {Array.from({ length: 10 }).map(() => (
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit
                  risus, sed porttitor quam. Morbi accumsan cursus enim, sed ultricies sapien.
                </p>
              ))}
            </div>
          </ScrollShadow>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="rounded bg-default p-4">
          <p class="text-sm font-semibold">
            Horizontal Shadow State: <span id="horizontal-state">{horizontalState()}</span>
          </p>
        </div>
        <div class="w-full">
          <ScrollShadow class="p-4" orientation="horizontal" onVisibilityChange={(visibility: ScrollShadowVisibility) => horizontalState.set(visibility)}>
            <div class="flex flex-row gap-4">
              {Array.from({ length: 10 }).map((_, idx) => (
                <Card class="flex min-w-[200px] flex-row gap-3 p-1" variant="transparent">
                  <img
                    alt="Lorem Card"
                    class="aspect-square h-16 w-16 shrink-0 rounded-xl object-cover select-none sm:h-20 sm:w-20"
                    loading="lazy"
                    src={getRandomImage(idx)}
                  />
                  <div class="flex flex-1 flex-col justify-center gap-1">
                    <Card.Title class="text-sm">Bridging the Future</Card.Title>
                    <Card.Description class="text-xs">Today, 6:30 PM</Card.Description>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollShadow>
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <VisibilityChange />
    </div>
  );
}
