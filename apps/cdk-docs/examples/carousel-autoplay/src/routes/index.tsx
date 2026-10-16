import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselRotationControl, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { Pause, Play } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Autoplay with a rotation control" };

const offers = ["Spring sale", "Free shipping", "New arrivals", "Gift cards"];

// #region demo
export default function AutoplayCarousel() {
  return (
    <div class="m-4 w-80">
      <Carousel id="offers" aria-label="Offers" loop autoplay={{ delay: 3000 }} tabs>
        {({ isRotating }) => (
          <>
            <CarouselViewport class="rounded-xl">
              <CarouselContainer items={offers}>
                {(name: string) => (
                  <CarouselSlide class="px-1">
                    <div class="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-xl font-semibold text-slate-700">
                      {name}
                    </div>
                  </CarouselSlide>
                )}
              </CarouselContainer>
            </CarouselViewport>
            <div class="mt-3 flex items-center justify-between">
              <CarouselRotationControl
                id="rotation"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
              >
                {() => <Icon icon={isRotating() ? Pause : Play} size={16} />}
              </CarouselRotationControl>
              <CarouselDots class="flex gap-2">
                {(index) => (
                  <CarouselDot
                    index={index}
                    class="h-2.5 w-2.5 rounded-full bg-slate-300 data-[selected]:bg-indigo-600 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
                  />
                )}
              </CarouselDots>
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
