// Home hero motion (DOCS-FAST 2026-10-26): the aurora canvas and the rotating headline word as ONE plain module script
// (docs-kit `docsSite({ scripts: { "/": … } })`, linked with `fetchpriority="low"` on the home page only), no resume
// runtime or boundary. As `HomeCanvas` / `HomeHeadline` boundaries with `visible` client effects they booted the
// runtime at load, and adopting them pulled the App root, layout, site chrome (cdk menu / dialog / popover) and the
// whole home route: 72 High-priority scripts in a 3-deep waterfall before the hero settled (Lighthouse mobile LCP
// 4.4 s). Same behaviour: aurora drift (paused off screen, in hidden tabs, by its button; one still frame under
// reduced motion), word rotation every 3.1 s with letter stagger (WAAPI; none under reduced motion), both pause buttons.
// A .ts module: browser globals are fine.
import { mountHomeAurora } from "./home-aurora.ts";

const WORDS = ["alive.", "fast.", "fluid."];
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Pause buttons: toggle the attribute, label and pressed state (icons swap by CSS). */
function pauseButton(button: HTMLButtonElement, toggle: () => boolean, label: (paused: boolean) => string): void {
  button.addEventListener("click", () => {
    const paused = toggle();
    button.setAttribute("aria-label", label(paused));
    button.setAttribute("aria-pressed", String(paused));
  });
}

function aurora(backdrop: HTMLElement): void {
  mountHomeAurora(backdrop);
  const button = backdrop.querySelector<HTMLButtonElement>(".hs-ambient-control");
  if (button)
    pauseButton(
      button,
      () => backdrop.toggleAttribute("data-paused"),
      (paused) => (paused ? "Resume background animation" : "Pause background animation"),
    );
}

function headline(root: HTMLElement): void {
  const word = root.querySelector<HTMLElement>(".hs-word");
  if (!word) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0,
    visible = true,
    busy = false,
    paused = false,
    transition = 0,
    frame = 0;
  let running: Animation[] = [];
  const letters = () => [...word.querySelectorAll<HTMLElement>(".hs-word-letter")];
  // One shared gradient across the letters (each letter clips its slice), re-measured when the word changes size.
  const syncGradient = () => {
    word.style.setProperty("--word-width", `${word.getBoundingClientRect().width}px`);
    for (const letter of letters()) letter.style.setProperty("--word-offset", `${letter.offsetLeft}px`);
    word.setAttribute("data-gradient-ready", "");
  };
  const show = (text: string) => {
    word.replaceChildren(
      ...Array.from(text, (char) => {
        const letter = document.createElement("span");
        letter.className = "hs-word-letter";
        letter.textContent = char;
        return letter;
      }),
    );
  };
  const stop = () => {
    for (const animation of running) animation.cancel();
    running = [];
  };
  const play = (keyframes: Keyframe[], duration: number, stagger: number, easing?: string) => {
    stop();
    running = letters().map((letter, i) =>
      letter.animate(keyframes, { duration, delay: i * stagger, fill: "both", ...(easing ? { easing } : {}) }),
    );
    return Promise.all(running.map((animation) => animation.finished)).then(
      () => true,
      () => false,
    );
  };
  const tick = async () => {
    if (reduce.matches || document.hidden || !visible || paused || busy) return;
    busy = true;
    const current = ++transition;
    const out = await play([{ opacity: 1, transform: "none", filter: "blur(0px)" }, { opacity: 0, transform: "translateY(-14px)", filter: "blur(8px)" }], 220, 18);
    if (current !== transition) return;
    if (!out) return void (busy = false);
    index = (index + 1) % WORDS.length;
    word.style.visibility = "hidden";
    stop();
    show(WORDS[index]!);
    frame = requestAnimationFrame(() => {
      if (current !== transition) return;
      syncGradient();
      word.style.visibility = "";
      void play(
        [
          { opacity: 0, transform: "translateY(18px)", filter: "blur(8px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        420,
        28,
        EASE,
      ).then((done) => {
        if (current !== transition) return;
        if (done) stop();
        busy = false;
      });
    });
  };
  new ResizeObserver(syncGradient).observe(word);
  syncGradient();
  void document.fonts.ready.then(syncGradient);
  setInterval(() => void tick(), 3100);
  new IntersectionObserver(([entry]) => {
    visible = entry!.isIntersecting;
  }).observe(root);
  // Reduced motion switched on mid-rotation: back to the first word, still.
  reduce.addEventListener("change", () => {
    if (!reduce.matches) return;
    transition++;
    cancelAnimationFrame(frame);
    stop();
    index = 0;
    word.style.visibility = "";
    show(WORDS[0]!);
    busy = false;
    frame = requestAnimationFrame(syncGradient);
  });
  const button = root.querySelector<HTMLButtonElement>(".hs-word-pause");
  if (button)
    pauseButton(
      button,
      () => (paused = !paused),
      (now) => (now ? "Resume headline animation" : "Pause headline animation"),
    );
}

const backdrop = document.querySelector<HTMLElement>(".hs-backdrop");
if (backdrop) aurora(backdrop);
const title = document.querySelector<HTMLElement>(".hs-headline");
if (title) headline(title);
