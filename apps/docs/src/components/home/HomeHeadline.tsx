import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { animate, stagger } from "@rivetjs/motion/animate";
import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

const WORDS = ["alive.", "fast.", "fluid."];
export function HomeHeadline() {
  const word = signal("alive.");
  const paused = signal(false);
  const root = ref<HTMLElement>();
  clientEffect(
    () => {
      const node = root();
      if (!node) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)");
      let index = 0,
        visible = true,
        busy = false,
        disposed = false;
      let frame = 0;
      let animation: ReturnType<typeof animate> | undefined;
      const syncGradient = () => {
        if (disposed) return;
        const wordNode = node.querySelector<HTMLElement>(".hs-word");
        if (!wordNode) return;
        wordNode.style.setProperty("--word-width", `${wordNode.getBoundingClientRect().width}px`);
        for (const letter of wordNode.querySelectorAll<HTMLElement>(".hs-word-letter")) {
          // Layout offsets stay stable while Motion translates individual letters.
          letter.style.setProperty("--word-offset", `${letter.offsetLeft}px`);
        }
        wordNode.setAttribute("data-gradient-ready", "");
      };
      const resized = new ResizeObserver(syncGradient);
      const wordNode = node.querySelector<HTMLElement>(".hs-word");
      if (wordNode) resized.observe(wordNode);
      syncGradient();
      void document.fonts.ready.then(syncGradient);
      const tick = async () => {
        if (reduce.matches || document.hidden || !visible || paused() || busy) return;
        busy = true;
        const letters = [...node.querySelectorAll<HTMLElement>(".hs-word-letter")];
        animation = animate(letters, { opacity: 0, y: -16, filter: "blur(4px)" }, { duration: 0.18, delay: stagger(0.018) });
        await animation;
        if (disposed || reduce.matches) {
          busy = false;
          return;
        }
        index = (index + 1) % WORDS.length;
        word.set(WORDS[index]!);
        frame = requestAnimationFrame(() => {
          if (disposed) return;
          syncGradient();
          const next = [...node.querySelectorAll<HTMLElement>(".hs-word-letter")];
          animation = animate(
            next,
            { opacity: [0, 1], y: [18, 0], filter: ["blur(4px)", "blur(0px)"] },
            { duration: 0.32, delay: stagger(0.025), ease: [0.22, 1, 0.36, 1] },
          );
          void animation.then(() => {
            busy = false;
          });
        });
      };
      const timer = setInterval(() => {
        void tick();
      }, 3100);
      const seen = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      seen.observe(node);
      const staticWord = () => {
        if (!reduce.matches) return;
        animation?.stop();
        word.set("alive.");
        busy = false;
        for (const letter of node.querySelectorAll<HTMLElement>(".hs-word-letter")) {
          letter.style.opacity = "1";
          letter.style.transform = "none";
          letter.style.filter = "none";
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(syncGradient);
      };
      reduce.addEventListener("change", staticWord);
      return () => {
        disposed = true;
        clearInterval(timer);
        cancelAnimationFrame(frame);
        animation?.stop();
        seen.disconnect();
        resized.disconnect();
        reduce.removeEventListener("change", staticWord);
      };
    },
    { when: "visible" },
  );
  return (
    <div class="hs-headline" ref={root}>
      <h1 id="lp-title" aria-label="Make the web feel alive, fast and fluid.">
        <span>Make the web</span>
        <span class="hs-title-line" aria-hidden="true">
          feel{" "}
          <span class="hs-word-window">
            <span class="hs-word">
              {Array.from(word()).map((char) => (
                <span class="hs-word-letter">{char}</span>
              ))}
            </span>
          </span>
        </span>
      </h1>
      <button
        class="hs-word-pause"
        type="button"
        aria-label={paused() ? "Resume headline animation" : "Pause headline animation"}
        aria-pressed={paused()}
        onClick={() => paused.set(!paused())}
      >
        <Icon icon={paused() ? Play : Pause} size={13} />
      </button>
    </div>
  );
}
