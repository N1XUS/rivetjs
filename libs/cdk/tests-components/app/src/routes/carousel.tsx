// Carousel stories: embla engine under the cdk parts on a resumed page. `#basic` starts at slide 2 (server transform
// from `--rv-carousel-slide-size`), `#tabbed` = APG tabbed carousel (CarouselDots), `#looped` = loop. No carousel
// code may run before the first interaction (no autoplay here); then drag, buttons, keys and dots must work.
import { signal } from "@rivetjs/reactivity";
import { Carousel, CarouselContainer, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";

const viewport = { width: "300px" };
const slide = { height: "120px", display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", border: "1px solid #999" };
const colors = ["Red", "Green", "Blue", "Cyan", "Magenta"];

export default function CarouselStories() {
  const selected = signal(-1);
  const spacingSelections = signal("");
  return (
    <main>
      <h1>Carousel</h1>
      <Carousel
        id="spacing"
        aria-label="Spacing"
        align="start"
        slideCount={5}
        style={{ "--rv-carousel-slide-size": "33.333%" }}
        onSelect={(index) => spacingSelections.set(spacingSelections() + index + ",")}
      >
        <CarouselViewport style={{ width: "384px" }}>
          <CarouselContainer style={{ gap: "4px" }}>
            {colors.map((name) => (
              <CarouselSlide style={{ height: "60px" }}>{name}</CarouselSlide>
            ))}
          </CarouselContainer>
        </CarouselViewport>
        <CarouselPrevious id="spacing-prev">Previous</CarouselPrevious>
        <CarouselNext id="spacing-next">Next</CarouselNext>
      </Carousel>
      <output id="spacing-selections">{spacingSelections()}</output>
      <Carousel id="basic" aria-label="Basic" startIndex={1} slideCount={5} onSelect={(index) => selected.set(index)}>
        <CarouselViewport style={viewport}>
          <CarouselContainer>
            {colors.map((name) => (
              <CarouselSlide style={slide}>{name}</CarouselSlide>
            ))}
          </CarouselContainer>
        </CarouselViewport>
        <CarouselPrevious id="basic-prev">Previous</CarouselPrevious>
        <CarouselNext id="basic-next">Next</CarouselNext>
      </Carousel>
      <output id="basic-selected">{String(selected())}</output>
      <Carousel id="tabbed" aria-label="Tabbed" tabs>
        <CarouselViewport style={viewport}>
          <CarouselContainer items={colors}>{(name: string) => <CarouselSlide style={slide}>{name}</CarouselSlide>}</CarouselContainer>
        </CarouselViewport>
        <CarouselDots />
      </Carousel>
      <Carousel id="looped" aria-label="Looped" loop slideCount={5}>
        <CarouselViewport style={viewport}>
          <CarouselContainer>
            {colors.map((name) => (
              <CarouselSlide style={slide}>{name}</CarouselSlide>
            ))}
          </CarouselContainer>
        </CarouselViewport>
        <CarouselPrevious id="looped-prev">Previous</CarouselPrevious>
        <CarouselNext id="looped-next">Next</CarouselNext>
      </Carousel>
    </main>
  );
}
