// Lightbox stories on a resumed page. `#open-2` (a thumbnail button) opens the modal lightbox at slide 2 (Zoom, Counter,
// Captions, Thumbnails parts); `#inline` is a server-rendered inline lightbox. Nothing may boot at load: the closed
// modal renders only its overlay anchor, the inline view installs its listeners on the first interaction.
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
import { LightboxCaptions } from "@rivetjs/cdk/lightbox/captions";
import { LightboxCounter } from "@rivetjs/cdk/lightbox/counter";
import { LightboxEmbed } from "@rivetjs/cdk/lightbox/embed";
import { LightboxInline } from "@rivetjs/cdk/lightbox/inline";
import { LightboxThumbnails } from "@rivetjs/cdk/lightbox/thumbnails";
import { LightboxZoom, LightboxZoomIn } from "@rivetjs/cdk/lightbox/zoom";

const png = (body: string) => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR42${body}AAAAASUVORK5CYII=`;
const slides: LightboxSlide[] = [
  { src: png("mM4YWODFTEMpAQAr9U8ASfI0t8"), alt: "Red", width: 8, height: 6, title: "Red" },
  { src: png("mOwWRCFFTEMpAQAA1U6IfpFvn0"), alt: "Green", width: 8, height: 6, title: "Green" },
  { src: png("mOwiTqBFTEMpAQAIVNBoT6/1Bo"), alt: "Blue", width: 8, height: 6, title: "Blue" },
  { type: "embed", provider: "youtube", id: "aqz-KE-bpKQ", title: "Embedded video" },
];

export default function LightboxStories() {
  const isOpen = signal(false);
  const index = signal(0);
  return (
    <main>
      <h1>Lightbox</h1>
      <button
        id="open-2"
        type="button"
        onClick={() => {
          index.set(1);
          isOpen.set(true);
        }}
      >
        Open green
      </button>
      <output id="index">{String(index())}</output>
      <Lightbox isOpen={isOpen} index={index} slides={slides} aria-label="Gallery">
        {() => (
          <>
            <LightboxCarousel>{(slide) => (slide.type === "embed" ? <LightboxEmbed /> : <LightboxImage />)}</LightboxCarousel>
            <LightboxZoom />
            <LightboxToolbar>
              <LightboxZoomIn />
              <LightboxClose>Close</LightboxClose>
            </LightboxToolbar>
            <LightboxCounter />
            <LightboxCaptions />
            <LightboxPrevious>Previous</LightboxPrevious>
            <LightboxNext>Next</LightboxNext>
            <LightboxThumbnails width={40} height={30} />
          </>
        )}
      </Lightbox>
      <LightboxInline id="inline" slides={slides.slice(0, 3)} style={{ width: "320px", height: "200px" }} />
    </main>
  );
}
