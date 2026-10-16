// Rivet-authored demo (Lightbox is a Rivet addition: yet-another-react-lightbox behaviour from @rivetjs/cdk/lightbox, HeroUI look).
import { Lightbox, LightboxCaptions, LightboxCounter, LightboxInline, type LightboxSlide } from "@rivetjs/ui/lightbox";
import avocado from "../assets/avocado.jpg?image";
import cactus from "../assets/cactus.jpg?image";
import cherries from "../assets/cherries.jpg?image";
import robot from "../assets/robot-face.jpg?image";

export const head = { title: "Lightbox: Inline" };

const slides: LightboxSlide[] = [
  { ...robot, alt: "Knitted robot head", title: "Robot", description: "A knitted domestic robot, front view." },
  { ...avocado, alt: "Avocado half on pink", title: "Avocado", description: "One avocado half on a pastel background." },
  { ...cherries, alt: "Two cherries on mint", title: "Cherries" },
  { ...cactus, alt: "Cactus in a terracotta pot", title: "Cactus" },
];

// #region demo
export default function LightboxInlineDemo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LightboxInline slides={slides} carousel={{ finite: true }} aria-label="Photos" class="h-80 w-[36rem] overflow-hidden rounded-3xl">
        {() => (
          <>
            <Lightbox.Slides />
            <Lightbox.Previous />
            <Lightbox.Next />
            <LightboxCounter />
            <LightboxCaptions />
          </>
        )}
      </LightboxInline>
    </div>
  );
}
// #endregion
