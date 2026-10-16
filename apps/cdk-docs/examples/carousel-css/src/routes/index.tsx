import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";

export const head = { title: "Carousel with plain CSS" };

const colors = ["Indigo", "Cyan", "Violet", "Magenta"];

// #region demo
export default function CssCarousel() {
  return (
    <Carousel id="colors" aria-label="Colors" align="start">
      <CarouselViewport>
        <CarouselContainer items={colors}>
          {(name: string) => (
            <CarouselSlide>
              <div>{name}</div>
            </CarouselSlide>
          )}
        </CarouselContainer>
      </CarouselViewport>
      <div class="controls">
        <CarouselPrevious id="prev">Previous</CarouselPrevious>
        <CarouselNext id="next">Next</CarouselNext>
      </div>
    </Carousel>
  );
}
// #endregion
