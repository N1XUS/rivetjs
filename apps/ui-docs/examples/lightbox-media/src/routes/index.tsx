// Rivet-authored demo (Lightbox is a Rivet addition: yet-another-react-lightbox behaviour from @rivetjs/cdk/lightbox, HeroUI look).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Lightbox, LightboxCounter, LightboxThumbnails, type LightboxSlide } from "@rivetjs/ui/lightbox";
import robot from "../assets/robot-face.jpg?image";
import robotProfile from "../assets/robot-profile.jpg?image";
import poster from "../assets/lightbox-clip-poster.jpg?image";
import clip from "../assets/lightbox-clip.mp4?url";
import pdf from "../assets/lightbox-sample.pdf?url";

export const head = { title: "Lightbox: Video, embed and PDF" };

const slides: LightboxSlide[] = [
  { type: "video", poster: poster.src, width: 384, height: 216, muted: true, loop: true, sources: [{ src: clip, type: "video/mp4" }], title: "Test clip" },
  { type: "embed", provider: "youtube", id: "aqz-KE-bpKQ", poster: robotProfile.src, width: 1280, height: 720, title: "Big Buck Bunny (YouTube)" },
  { ...robot, alt: "Knitted robot head", title: "Robot" },
  { type: "pdf", src: pdf, width: 420, height: 595, title: "Sample PDF" },
];

// #region demo
export default function LightboxMediaDemo() {
  const open = signal(false);
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Button id="open-media" onPress={() => open.set(true)}>
        Open media
      </Button>
      <Lightbox isOpen={open} slides={slides} aria-label="Media">
        {() => (
          <>
            <Lightbox.Slides />
            <Lightbox.Toolbar>
              <Lightbox.Close />
            </Lightbox.Toolbar>
            <Lightbox.Previous />
            <Lightbox.Next />
            <LightboxCounter />
            <LightboxThumbnails />
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
