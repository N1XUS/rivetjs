// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import avocadoImage from "../assets/avocado.jpg?image";
import cherriesImage from "../assets/cherries.jpg?image";
import orangesImage from "../assets/oranges.jpg?image";

export const head = { title: "Carousel: With cards" };

const FRUITS = [
  { name: "Avocado", src: avocadoImage.src, text: "Creamy, rich in healthy fats." },
  { name: "Cherries", src: cherriesImage.src, text: "Sweet and tart summer stone fruit." },
  { name: "Oranges", src: orangesImage.src, text: "Juicy citrus packed with vitamin C." },
];

// #region demo
export function CarouselCards() {
  return (
    <Carousel aria-label="Fruits" align="start" placement="outside" slideCount={FRUITS.length} class="w-[min(30rem,100%)] [--rv-carousel-slide-size:80%]">
      <Carousel.Content>
        {FRUITS.map((fruit) => (
          <Carousel.Item>
            <Card class="h-full">
              <img src={fruit.src} alt={fruit.name} class="aspect-video w-full rounded-2xl object-cover" />
              <Card.Header>
                <Card.Title>{fruit.name}</Card.Title>
                <Card.Description>{fruit.text}</Card.Description>
              </Card.Header>
              <Card.Footer>
                <Button size="sm" variant="secondary">
                  Add to cart
                </Button>
              </Card.Footer>
            </Card>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-cards-prev" variant="secondary" />
      <Carousel.Next id="carousel-cards-next" variant="secondary" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselCards />
    </div>
  );
}
