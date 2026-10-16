import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";

export const head = { title: "Tabbed carousel with dots" };

const seasons = ["Spring", "Summer", "Autumn", "Winter"];

// #region demo
export default function DotsCarousel() {
  return (
    <div class="m-4 w-80">
      <Carousel id="seasons" aria-label="Seasons" tabs>
        <CarouselViewport class="rounded-xl">
          <CarouselContainer items={seasons}>
            {(name: string) => (
              <CarouselSlide class="px-1">
                <div class="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-xl font-semibold text-slate-700">
                  {name}
                </div>
              </CarouselSlide>
            )}
          </CarouselContainer>
        </CarouselViewport>
        <CarouselDots class="mt-3 flex justify-center gap-2">
          {(index) => (
            <CarouselDot
              index={index}
              aria-label={seasons[index]}
              class="h-2.5 w-6 rounded-full bg-slate-300 data-[selected]:bg-indigo-600 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
            />
          )}
        </CarouselDots>
      </Carousel>
    </div>
  );
}
// #endregion
