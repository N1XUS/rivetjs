// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/scroll-shadow/orientation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Card } from "@rivetjs/ui/card";
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
import avocadoImage from "../assets/avocado.jpg?image";
import orangesImage from "../assets/oranges.jpg?image";
import robotImage from "../assets/robot.jpg?image";

export const head = { title: "ScrollShadow: Orientation" };

// #region demo
const images = [robotImage.src, avocadoImage.src, orangesImage.src];

const getRandomImage = (idx: number) => images[idx % images.length];

export function Orientation() {
  return (
    <div class="w-full sm:max-w-sm">
      <div class="mb-8 w-full">
        <h4 class="mb-2 text-sm font-semibold">Vertical</h4>
        <Card class="w-full p-0">
          <ScrollShadow class="max-h-[240px] p-4" orientation="vertical">
            <div class="space-y-4">
              {Array.from({ length: 10 }).map(() => (
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit
                  risus, sed porttitor quam. Morbi accumsan cursus enim, sed ultricies sapien.
                </p>
              ))}
            </div>
          </ScrollShadow>
        </Card>
      </div>

      <div class="w-full">
        <h4 class="mb-2 text-sm font-semibold">Horizontal</h4>
        <Card class="w-full p-0">
          <ScrollShadow class="p-4" orientation="horizontal">
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
        </Card>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Orientation />
    </div>
  );
}
