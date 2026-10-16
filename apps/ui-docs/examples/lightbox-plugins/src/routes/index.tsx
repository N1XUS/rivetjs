// Rivet-authored demo (Lightbox is a Rivet addition: yet-another-react-lightbox behaviour from @rivetjs/cdk/lightbox, HeroUI look).
import { signal } from "@rivetjs/reactivity";
import {
  Lightbox,
  LightboxCaptions,
  LightboxCaptionsToggle,
  LightboxCounter,
  LightboxDownload,
  LightboxFullscreen,
  LightboxShare,
  LightboxSlideshow,
  LightboxThumbnails,
  LightboxThumbnailsToggle,
  LightboxZoom,
  LightboxZoomIn,
  LightboxZoomOut,
  type LightboxSlide,
  type LightboxSlideImage,
} from "@rivetjs/ui/lightbox";
import avocado from "../assets/avocado.jpg?image";
import cactus from "../assets/cactus.jpg?image";
import cherries from "../assets/cherries.jpg?image";
import robot from "../assets/robot-face.jpg?image";

export const head = { title: "Lightbox: Plugins" };

const slides: LightboxSlide[] = [
  { ...robot, alt: "Knitted robot head", title: "Robot", description: "A knitted domestic robot, front view." },
  { ...avocado, alt: "Avocado half on pink", title: "Avocado", description: "One avocado half on a pastel background." },
  { ...cherries, alt: "Two cherries on mint", title: "Cherries" },
  { ...cactus, alt: "Cactus in a terracotta pot", title: "Cactus" },
];

// #region demo
export default function LightboxPlugins() {
  const open = signal(false);
  const index = signal(0);
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <div class="w-96">
        <div class="grid grid-cols-4 gap-2">
          {slides.map((slide, i) => (
            <button
              id={`thumb-${i}`}
              type="button"
              class="overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`Open ${(slide as LightboxSlideImage).alt}`}
              onClick={() => {
                index.set(i);
                open.set(true);
              }}
            >
              <img src={(slide as LightboxSlideImage).src} alt="" class="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
        <Lightbox isOpen={open} index={index} slides={slides} backdrop="blur" aria-label="Photos">
          {() => (
            <>
              <Lightbox.Slides />
              <LightboxZoom maxZoomPixelRatio={2} />
              <Lightbox.Toolbar>
                <LightboxZoomIn />
                <LightboxZoomOut />
                <LightboxCaptionsToggle />
                <LightboxThumbnailsToggle />
                <LightboxSlideshow delay={2500} />
                <LightboxFullscreen />
                <LightboxDownload />
                <LightboxShare />
                <Lightbox.Close />
              </Lightbox.Toolbar>
              <Lightbox.Previous />
              <Lightbox.Next />
              <LightboxCounter />
              <LightboxCaptions />
              <LightboxThumbnails />
            </>
          )}
        </Lightbox>
      </div>
    </div>
  );
}
// #endregion
