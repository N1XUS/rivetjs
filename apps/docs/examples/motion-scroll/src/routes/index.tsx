import { ref } from "@rivetjs/runtime/dom";
import { createScroll } from "@rivetjs/motion/scroll";
import { createInView } from "@rivetjs/motion/in-view";
import { ArrowDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Motion scroll" };

// #region demo
export default function ScrollDemo() {
  const scroller = ref<HTMLElement>();
  const box = ref<HTMLElement>();
  // Signals: progress 0–1 through the container, and whether the box is visible.
  const scroll = createScroll({ container: scroller });
  const seen = createInView(box, { once: true, amount: 0.5, root: scroller });
  return (
    <div class="m-4 grid gap-2">
      <div class="h-1 origin-left rounded bg-teal-700" style={{ transform: `scaleX(${scroll.yProgress()})` }} />
      <p id="state" class="flex items-center gap-1 text-slate-700">
        {seen() ? "In view" : "Scroll down"}
        {!seen() && <Icon icon={ArrowDown} />}
      </p>
      <div id="scroller" ref={scroller} class="h-48 overflow-y-auto rounded-md border border-slate-300 p-4">
        <p class="h-96 text-slate-500">Keep scrolling…</p>
        <div
          ref={box}
          class={["rounded-md px-4 py-6 font-semibold text-white transition-colors duration-500", seen() ? "bg-teal-700" : "bg-slate-400"]}
        >
          Hello from below the fold
        </div>
      </div>
    </div>
  );
}
// #endregion
