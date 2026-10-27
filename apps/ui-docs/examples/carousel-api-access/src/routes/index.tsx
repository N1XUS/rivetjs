// Rivet-authored demo (Carousel is a Rivet addition; "API Access" section of HeroUI Pro's public docs, own content):
// `onApi` hands over the embla API; buttons outside the carousel drive it, `select` events update them.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Carousel, type CarouselRootProps } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: API access" };

type EmblaApi = Parameters<NonNullable<CarouselRootProps["onApi"]>>[0];

const SLIDES = ["Arrival", "Lobby", "Studio", "Terrace", "Night"];

// #region demo
export function CarouselApiAccess() {
  let api: EmblaApi | undefined;
  const selected = signal(0);
  const sync = () => selected.set(api?.selectedScrollSnap() ?? 0);
  return (
    <div class="flex w-full max-w-sm flex-col gap-3">
      <Carousel
        id="carousel-api-access"
        aria-label="Hotel tour"
        slideCount={SLIDES.length}
        onApi={(next) => {
          api = next;
          sync();
          next.on("select", sync);
        }}
      >
        <Carousel.Content>
          {SLIDES.map((title, index) => (
            <Carousel.Item>
              <Card>
                <Card.Content class="flex aspect-video items-center justify-center p-6">
                  <span class="text-lg font-semibold">
                    {index + 1}. {title}
                  </span>
                </Card.Content>
              </Card>
            </Carousel.Item>
          ))}
        </Carousel.Content>
      </Carousel>
      <div class="flex flex-wrap items-center gap-2">
        <Button id="cap-first" size="sm" variant="secondary" isDisabled={() => selected() === 0} onPress={() => api?.scrollTo(0)}>
          First
        </Button>
        {SLIDES.map((title, index) => (
          <Button
            id={`cap-go-${index + 1}`}
            size="sm"
            variant={selected() === index ? "primary" : "tertiary"}
            aria-label={`Go to ${title}`}
            onPress={() => api?.scrollTo(index)}
          >
            {index + 1}
          </Button>
        ))}
        <Button
          id="cap-last"
          size="sm"
          variant="secondary"
          isDisabled={() => selected() === SLIDES.length - 1}
          onPress={() => api?.scrollTo(SLIDES.length - 1)}
        >
          Last
        </Button>
      </div>
      <output id="cap-status" class="text-sm text-muted">
        {SLIDES[selected()]} ({selected() + 1} of {SLIDES.length})
      </output>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselApiAccess />
    </div>
  );
}
