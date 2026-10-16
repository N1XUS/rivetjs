// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";
import cactusImage from "../assets/cactus.jpg?image";
import personYellowImage from "../assets/person-yellow.jpg?image";
import robotFaceImage from "../assets/robot-face.jpg?image";
import robotProfileImage from "../assets/robot-profile.jpg?image";
import robotImage from "../assets/robot.jpg?image";

export const head = { title: "Carousel: Thumbnails" };

const PHOTOS = [cactusImage, robotFaceImage, robotImage, personYellowImage, robotProfileImage].map((image) => image.src);

// #region demo
export function CarouselThumbnails() {
  return (
    <Carousel id="carousel-thumbnails" aria-label="Photos" tabs placement="outside" slideCount={PHOTOS.length} class="w-[min(28rem,100%)]">
      <Carousel.Content>
        {PHOTOS.map((src, index) => (
          <Carousel.Item>
            <img src={src} alt={`Photo ${index + 1}`} class="aspect-[4/3] w-full rounded-3xl object-cover" />
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
      <Carousel.Thumbnails>{(index) => <img src={PHOTOS[index]} alt="" />}</Carousel.Thumbnails>
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselThumbnails />
    </div>
  );
}
