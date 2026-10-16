import { signal, computed } from "@rivetjs/reactivity";
import { clientEffect, clientEvent } from "@rivetjs/runtime/dom";
import type { Item } from "./context.js";

/** Server-rendered, resumed in the browser without running this component there. */
export function ResumeDemo({ items }: { items: Item[] }) {
  const count = signal(0);
  const query = signal("");
  const titles = items.map((item) => item.title.toLowerCase());
  const matches = computed(() => titles.filter((title) => title.includes(query().toLowerCase())).length);
  const width = signal(0);
  let canvas!: HTMLCanvasElement;
  clientEvent(window, "resize", () => width.set(innerWidth));
  clientEffect(() => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(0, 0, Math.min(canvas.width, 12 * count()), canvas.height);
    canvas.dataset.drawn = String(count());
  });
  return (
    <section aria-labelledby="resume-title">
      <h1 id="resume-title" class="text-2xl font-semibold">Resumed page</h1>
      <p class="mt-4 text-base leading-7 text-slate-600">
        Rendered on the server. The browser runs only a small loader until you interact.
      </p>
      <section class="mt-8 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="resume-counter">
        <h2 id="resume-counter" class="text-lg font-semibold">
          Counter
        </h2>
        <div class="mt-4 flex items-center gap-4">
          <button
            id="resume-increase"
            class="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => count.update((value) => value + 1)}
          >
            Increase count
          </button>
          <output id="resume-count" aria-live="polite" class="font-mono text-lg">
            {count()}
          </output>
        </div>
        <canvas id="resume-canvas" class="mt-4 h-3 w-full" width={240} height={12} ref={(el) => (canvas = el)} />
      </section>
      <section class="mt-8" aria-labelledby="resume-filter-title">
        <h2 id="resume-filter-title" class="text-lg font-semibold">
          Filter
        </h2>
        <label for="resume-filter" class="mt-3 block text-sm font-medium">
          Filter examples
        </label>
        <input
          id="resume-filter"
          class="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          type="search"
          model:value={query}
          placeholder="Search by title"
        />
        <p id="resume-matches" class="mt-3 text-sm text-slate-600">
          {matches()} of {titles.length} examples match
        </p>
        <p id="resume-width" class="mt-1 text-xs text-slate-500">
          Window width after resize: {width()}
        </p>
      </section>
    </section>
  );
}
