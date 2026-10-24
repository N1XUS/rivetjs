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
      let transition = 0;
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
        const current = ++transition;
        const letters = [...node.querySelectorAll<HTMLElement>(".hs-word-letter")];
        animation = animate(letters, { opacity: 0, y: -14, filter: "blur(8px)" }, { duration: 0.22, delay: stagger(0.018) });
        await animation;
        if (disposed || current !== transition) return;
        // Signal reconciliation and Motion's first frame happen separately. Keep new
        // glyphs hidden until their initial styles and shared gradient are ready.
        if (wordNode) wordNode.style.visibility = "hidden";
        index = (index + 1) % WORDS.length;
        word.set(WORDS[index]!);
        frame = requestAnimationFrame(() => {
          if (disposed || current !== transition) return;
          syncGradient();
          const next = [...node.querySelectorAll<HTMLElement>(".hs-word-letter")];
          for (const letter of next) {
            letter.style.opacity = "0";
            letter.style.filter = "blur(8px)";
          }
          if (wordNode) wordNode.style.visibility = "";
          animation = animate(
            next,
            { opacity: [0, 1], y: [18, 0], filter: ["blur(8px)", "blur(0px)"] },
            { duration: 0.42, delay: stagger(0.028), ease: [0.22, 1, 0.36, 1] },
          );
          void animation.then(() => {
            if (current === transition) busy = false;
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
        transition++;
        animation?.stop();
        index = 0;
        if (wordNode) wordNode.style.visibility = "";
        word.set("alive.");
        busy = false;
        // Reset Motion's cached values too: a queued render can overwrite direct styles.
        animation = animate([...node.querySelectorAll<HTMLElement>(".hs-word-letter")], { opacity: 1, y: 0, filter: "blur(0px)" }, { duration: 0 });
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
