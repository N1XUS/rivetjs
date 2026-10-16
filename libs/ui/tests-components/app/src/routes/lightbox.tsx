// Lightbox stories (`@rivetjs/ui/lightbox`) on a resumed page. `#lb-open` opens the modal lightbox at slide 2 (blur backdrop,
// Zoom, Counter, Captions, Thumbnails, captions toggle, Close); `#lb-inline` wraps a server-rendered inline lightbox (the cdk `id` names its parts, not the section). Nothing may
// boot at load: the closed modal renders only its overlay anchor.
import { signal } from "@rivetjs/reactivity";
import {
  Lightbox,
  LightboxCaptions,
  LightboxCaptionsToggle,
  LightboxCounter,
  LightboxInline,
  LightboxThumbnails,
  LightboxZoom,
  LightboxZoomIn,
  type LightboxSlide,
} from "@rivetjs/ui/lightbox";

const png = (body: string) => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR42${body}AAAAASUVORK5CYII=`;
const slides: LightboxSlide[] = [
  { src: png("mM4YWODFTEMpAQAr9U8ASfI0t8"), alt: "Red", width: 8, height: 6, title: "Red" },
  { src: png("mOwWRCFFTEMpAQAA1U6IfpFvn0"), alt: "Green", width: 8, height: 6, title: "Green", description: "Second slide" },
  { src: png("mOwiTqBFTEMpAQAIVNBoT6/1Bo"), alt: "Blue", width: 8, height: 6, title: "Blue" },
  { type: "pdf", src: "/missing.pdf", title: "Spec sheet" },
];

export default function LightboxStories() {
  const isOpen = signal(false);
  const index = signal(0);
  return (
    <main class="p-4">
      <h1>Lightbox</h1>
      <button
        id="lb-open"
        type="button"
        onClick={() => {
          index.set(1);
          isOpen.set(true);
        }}
      >
        Open green
      </button>
      <output id="lb-index">{String(index())}</output>
      <Lightbox isOpen={isOpen} index={index} slides={slides} backdrop="blur" aria-label="Gallery">
        {() => (
          <>
            <Lightbox.Slides />
            <LightboxZoom />
            <Lightbox.Toolbar>
              <LightboxZoomIn />
              <LightboxCaptionsToggle />
              <Lightbox.Close />
            </Lightbox.Toolbar>
            <Lightbox.Previous />
            <Lightbox.Next />
            <LightboxCounter />
            <LightboxCaptions />
            <LightboxThumbnails width={48} height={36} />
          </>
        )}
      </Lightbox>
      <div id="lb-inline">
        <LightboxInline slides={slides.slice(0, 3)} style={{ width: "320px", height: "200px" }} />
      </div>
    </main>
  );
}
