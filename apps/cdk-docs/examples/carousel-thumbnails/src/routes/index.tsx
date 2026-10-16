import { Carousel, CarouselContainer, CarouselSlide, CarouselViewport, carouselScrollTo } from "@rivetjs/cdk/carousel";

export const head = { title: "Carousel with thumbnails" };

const photos = ["Lake", "Peak", "Valley", "Ridge", "Meadow"];

// #region demo
export default function ThumbnailCarousel() {
  return (
    <div class="m-4 w-80">
      <Carousel id="photos" aria-label="Photos">
        {({ state, selectedIndex }) => (
          <>
            <CarouselViewport class="rounded-xl">
              <CarouselContainer items={photos}>
                {(name: string) => (
                  <CarouselSlide class="px-1">
                    <div class="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-xl font-semibold text-slate-700">
                      {name}
                    </div>
                  </CarouselSlide>
                )}
              </CarouselContainer>
            </CarouselViewport>
            <div class="mt-3 grid grid-cols-5 gap-1.5">
              {photos.map((name, index) => (
                <button
                  type="button"
                  id={`thumb-${index}`}
                  aria-label={`Show ${name}`}
                  aria-controls="photos-viewport"
                  aria-current={selectedIndex() === index ? "true" : undefined}
                  class="h-12 rounded-md bg-slate-100 text-xs text-slate-600 opacity-60 aria-[current]:opacity-100 aria-[current]:ring-2 aria-[current]:ring-indigo-500"
                  onClick={() => carouselScrollTo(state, index)}
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
