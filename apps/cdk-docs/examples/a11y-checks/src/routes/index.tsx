import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { isFocusable, isTabbable, isVisible, tabbables } from "@rivetjs/cdk/a11y";

export const head = { title: "Focusable and tabbable checks" };

const ids = ["off", "minus", "r1", "r2"];

// #region demo
export default function Checks() {
  const box = ref<HTMLDivElement>();
  const list = signal("");
  const flags = signal<Record<string, string>>({});
  const run = () => {
    const root = box()!;
    list.set(
      tabbables(root)
        .map((el) => el.id)
        .join(", "),
    );
    const out: Record<string, string> = {};
    for (const id of ids) {
      const el = root.querySelector("#" + id)!;
      out[id] = [isVisible(el) && "visible", isFocusable(el) && "focusable", isTabbable(el) && "tabbable"].filter(Boolean).join(" ");
    }
    flags.set(out);
  };
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div ref={box} class="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 p-2">
        <button id="ok" type="button" class="rounded border px-2 py-1">
          OK
        </button>
        <button id="off" type="button" disabled class="rounded border px-2 py-1 opacity-50">
          Off
        </button>
        <span id="minus" tabIndex={-1}>
          tabindex -1
        </span>
        <input type="hidden" id="secret" value="x" />
        {/* One tab stop per radio group: the checked radio. */}
        <label>
          <input type="radio" name="size" id="r1" /> S
        </label>
        <label>
          <input type="radio" name="size" id="r2" checked /> M
        </label>
        <a id="link" href="#top">
          Link
        </a>
        <button id="run" type="button" class="rounded-md bg-teal-700 px-2 py-1 font-semibold text-white" onClick={run}>
          Check
        </button>
      </div>
      <output id="tabbables" class="block font-mono text-xs">
        tabbables: {list()}
      </output>
      <ul class="font-mono text-xs">
        {ids.map((id) => (
          <li id={"r-" + id}>
            {id}: {flags()[id] ?? "?"}
          </li>
        ))}
      </ul>
    </section>
  );
}
// #endregion
