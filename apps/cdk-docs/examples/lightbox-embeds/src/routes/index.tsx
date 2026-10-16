import { signal } from "@rivetjs/reactivity";
import {
  Lightbox,
  LightboxCarousel,
  LightboxClose,
  LightboxImage,
  LightboxNext,
  LightboxPrevious,
  LightboxToolbar,
  type LightboxSlide,
} from "@rivetjs/cdk/lightbox";
import { LightboxEmbed } from "@rivetjs/cdk/lightbox/embed";
import { ChevronLeft, ChevronRight, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import robot from "../assets/robot-face.jpg?url";
import poster from "../assets/robot-profile.jpg?url";

export const head = { title: "Lightbox YouTube, Vimeo and iframe embeds" };

const slides: LightboxSlide[] = [
  { src: robot, alt: "Knitted robot head", width: 880, height: 495 },
  { type: "embed", provider: "youtube", id: "aqz-KE-bpKQ", title: "Big Buck Bunny (YouTube)", poster, width: 1280, height: 720 },
];

// #region demo
export default function EmbedLightbox() {
  const open = signal(false);
  return (
    <div class="m-4">
      <button id="open" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white" onClick={() => open.set(true)}>
        Open gallery
      </button>
      <Lightbox isOpen={open} slides={slides} aria-label="Gallery" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel>
              {(slide) => (slide.type === "embed" ? <LightboxEmbed class="rounded-xl" posterClass="rounded-xl" /> : <LightboxImage />)}
            </LightboxCarousel>
            <LightboxToolbar class="absolute end-0 top-0 z-10 flex gap-2 p-3 [grid-area:main]">
              <LightboxClose class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={X} size={20} />
              </LightboxClose>
            </LightboxToolbar>
            <LightboxPrevious class="absolute start-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronLeft} size={20} />
            </LightboxPrevious>
            <LightboxNext class="absolute end-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronRight} size={20} />
            </LightboxNext>
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
