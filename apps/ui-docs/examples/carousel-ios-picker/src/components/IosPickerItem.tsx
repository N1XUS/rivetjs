// Port of embla-carousel 8.6.0 `EmblaCarouselIosPickerItem.tsx` (packages/embla-carousel-docs, SandboxFilesSrc/IosPicker,
// MIT, © David Jerleke), on the ui Carousel: embla's own translate is switched off; on every scroll the track rotates around
// the X axis and each slide in view is placed on the wheel (rotateX + translateZ).
import type { EmblaCarouselType } from "@rivetjs/cdk/carousel/engine";
import { Carousel } from "@rivetjs/ui/carousel";

const CIRCLE_DEGREES = 360;
const WHEEL_ITEM_SIZE = 32;
const WHEEL_ITEM_COUNT = 18;
const WHEEL_ITEMS_IN_VIEW = 4;

export const WHEEL_ITEM_RADIUS = CIRCLE_DEGREES / WHEEL_ITEM_COUNT;
export const IN_VIEW_DEGREES = WHEEL_ITEM_RADIUS * WHEEL_ITEMS_IN_VIEW;
export const WHEEL_RADIUS = Math.round(WHEEL_ITEM_SIZE / 2 / Math.tan(Math.PI / WHEEL_ITEM_COUNT));

const isInView = (wheelLocation: number, slidePosition: number): boolean => Math.abs(wheelLocation - slidePosition) < IN_VIEW_DEGREES;

const setSlideStyles = (emblaApi: EmblaCarouselType, index: number, loop: boolean, slideCount: number, totalRadius: number): void => {
  const slideNode = emblaApi.slideNodes()[index];
  const wheelLocation = emblaApi.scrollProgress() * totalRadius;
  const positionDefault = emblaApi.scrollSnapList()[index] * totalRadius;
  const positionLoopStart = positionDefault + totalRadius;
  const positionLoopEnd = positionDefault - totalRadius;

  let inView = false;
  let angle = index * -WHEEL_ITEM_RADIUS;

  if (isInView(wheelLocation, positionDefault)) {
    inView = true;
  }

  if (loop && isInView(wheelLocation, positionLoopEnd)) {
    inView = true;
    angle = -CIRCLE_DEGREES + (slideCount - index) * WHEEL_ITEM_RADIUS;
  }

  if (loop && isInView(wheelLocation, positionLoopStart)) {
    inView = true;
    angle = -(totalRadius % CIRCLE_DEGREES) - index * WHEEL_ITEM_RADIUS;
  }

  if (inView) {
    slideNode.style.opacity = "1";
    slideNode.style.transform = `translateY(-${index * 100}%) rotateX(${angle}deg) translateZ(${WHEEL_RADIUS}px)`;
  } else {
    slideNode.style.opacity = "0";
    slideNode.style.transform = "none";
  }
};

export const setContainerStyles = (emblaApi: EmblaCarouselType, wheelRotation: number): void => {
  emblaApi.containerNode().style.transform = `translateZ(${WHEEL_RADIUS}px) rotateX(${wheelRotation}deg)`;
};

const inactivateEmblaTransform = (emblaApi: EmblaCarouselType): void => {
  const { translate, slideLooper } = emblaApi.internalEngine();
  translate.clear();
  translate.toggleActive(false);
  slideLooper.loopPoints.forEach(({ translate }) => {
    translate.clear();
    translate.toggleActive(false);
  });
};

const rotateWheel = (emblaApi: EmblaCarouselType, slideCount: number, loop: boolean): void => {
  const totalRadius = slideCount * WHEEL_ITEM_RADIUS;
  const rotationOffset = loop ? 0 : WHEEL_ITEM_RADIUS;
  const rotation = slideCount * WHEEL_ITEM_RADIUS - rotationOffset;
  const wheelRotation = rotation * emblaApi.scrollProgress();
  setContainerStyles(emblaApi, wheelRotation);
  emblaApi.slideNodes().forEach((_, index) => {
    setSlideStyles(emblaApi, index, loop, slideCount, totalRadius);
  });
};

type PropType = {
  id: string;
  loop?: boolean;
  label: string;
  slideCount: number;
  perspective: "left" | "right";
};

export function IosPickerItem(props: PropType) {
  const { id, slideCount, perspective, label } = props;
  const loop = props.loop ?? false;
  const slides = Array.from(Array(slideCount).keys());

  return (
    <div class="ios-picker">
      <div class="ios-picker-scene">
        <Carousel
          id={id}
          aria-label={label}
          orientation="vertical"
          loop={loop}
          dragFree
          containScroll={false}
          watchSlides={false}
          slideCount={slideCount}
          class="w-full [--carousel-gap:0px] [--carousel-height:32px] [--carousel-radius:0px]"
          onApi={(emblaApi) => {
            emblaApi.on("pointerUp", (emblaApi) => {
              const { scrollTo, target, location } = emblaApi.internalEngine();
              const diffToTarget = target.get() - location.get();
              const factor = Math.abs(diffToTarget) < WHEEL_ITEM_SIZE / 2.5 ? 10 : 0.1;
              const distance = diffToTarget * factor;
              scrollTo.distance(distance, true);
            });
            emblaApi.on("scroll", (emblaApi) => rotateWheel(emblaApi, slideCount, loop));
            emblaApi.on("reInit", (emblaApi) => {
              inactivateEmblaTransform(emblaApi);
              rotateWheel(emblaApi, slideCount, loop);
            });
            inactivateEmblaTransform(emblaApi);
            rotateWheel(emblaApi, slideCount, loop);
          }}
        >
          <Carousel.Content
            viewportClass={`ios-picker-viewport ios-picker-viewport--perspective-${perspective} overflow-visible!`}
            class="ios-picker-container"
          >
            {slides.map((slide) => (
              <Carousel.Item class="ios-picker-slide">{slide}</Carousel.Item>
            ))}
          </Carousel.Content>
        </Carousel>
      </div>
      <div class="ios-picker-label">{label}</div>
    </div>
  );
}
