import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: Tailwind" };

const tasks = Array.from({ length: 2000 }, (_, i) => ({ id: i, title: `Task ${i}`, done: i % 5 === 0 }));

// #region demo
export default function Tasks() {
  const top = signal(0);
  return (
    <section class="m-4 grid justify-items-start gap-2 text-sm text-slate-900">
      <button
        id="tw-list-bottom"
        type="button"
        class="w-fit rounded border border-slate-300 px-2 py-0.5"
        onClick={() => {
          const scroller = document.getElementById("tw-list")!;
          scroller.scrollTop = scroller.scrollHeight;
        }}
      >
        Bottom
      </button>
      <Virtualizer
        id="tw-list"
        role="list"
        label="Tasks"
        tabIndex={0}
        class="h-60 w-80 rounded-xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        itemClass="transition-colors hover:bg-indigo-50 data-[rv-type=loader]:bg-transparent"
        items={tasks}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 36 }}
        initialSize={{ width: 320, height: 240 }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(task, view) => (
          <div
            role="listitem"
            data-odd={String(view().index % 2 === 1)}
            class="flex h-full items-center justify-between border-b border-slate-100 px-3 data-[odd=true]:bg-slate-50"
          >
            <span>{task().title}</span>
            <span class={task().done ? "rounded bg-emerald-100 px-1.5 text-xs text-emerald-800" : "hidden"}>done</span>
          </div>
        )}
      </Virtualizer>
      <output id="tw-top" class="text-slate-500">
        scrollTop: {top()}
      </output>
    </section>
  );
}
// #endregion
