import { signal } from "@rivetjs/reactivity";
import { For, ref } from "@rivetjs/runtime/dom";
import { Motion } from "@rivetjs/motion";
import { animateLayout, LayoutGroup } from "@rivetjs/motion/layout";
import { Shuffle } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Motion layout" };

const tabs = ["Overview", "Activity", "Settings"];

// #region demo
export default function LayoutDemo() {
  const selected = signal(0);
  const order = signal([1, 2, 3, 4, 5, 6]);
  const grid = ref<HTMLElement>();
  return (
    <div class="m-4 grid gap-6">
      <LayoutGroup id="tabs">
        <div role="tablist" class="flex gap-4 border-b border-slate-200">
          {tabs.map((label, i) => (
            <button
              id={"tab-" + i}
              role="tab"
              type="button"
              aria-selected={selected() === i}
              class="relative px-1 pb-2 font-medium text-slate-700"
              // animateLayout: the underline moves from the old tab's box to the new one.
              onClick={() => animateLayout(undefined, () => selected.set(i), { duration: 0.3 })}
            >
              {label}
              {selected() === i && <Motion.span layoutId="underline" class="absolute inset-x-0 -bottom-px h-0.5 bg-teal-700" />}
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div id="grid" ref={grid} class="grid grid-cols-3 gap-2">
        {/* Keyed rows: each tile keeps its element, so it animates from its old box. */}
        <For each={order} by={(n) => n}>
          {(n) => (
            <Motion.div layout class="grid h-14 place-items-center rounded-md bg-slate-100 font-semibold text-slate-700">
              {n()}
            </Motion.div>
          )}
        </For>
      </div>
      <button
        id="shuffle"
        type="button"
        class="flex items-center gap-1 justify-self-start rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white"
        onClick={() => animateLayout(grid, () => order.update((list) => [...list.slice(1), list[0]!]))}
      >
        <Icon icon={Shuffle} />
        Rotate
      </button>
    </div>
  );
}
// #endregion
