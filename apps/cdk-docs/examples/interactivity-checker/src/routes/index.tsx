import { signal } from "@rivetjs/reactivity";
import { getInteractivityChecker } from "@rivetjs/cdk/a11y/interactivity-checker";

export const head = { title: "InteractivityChecker" };

const ids = ["plain", "disabled", "minus", "hidden", "div"];

// #region demo
export default function Checks() {
  const results = signal<Record<string, string>>({});
  const check = () => {
    const checker = getInteractivityChecker();
    const out: Record<string, string> = {};
    for (const id of ids) {
      const el = document.getElementById(id)!;
      const flags = [
        checker.isDisabled(el) && "disabled",
        checker.isFocusable(el) && "focusable",
        checker.isTabbable(el) && checker.isFocusable(el) && "tabbable",
        checker.isVisible(el) && "visible",
      ].filter(Boolean);
      out[id] = flags.join(" ") || "none";
    }
    results.set(out);
  };
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <button id="plain" type="button" class="rounded border px-2 py-1">
          Button
        </button>
        <button id="disabled" type="button" disabled class="rounded border px-2 py-1 opacity-50">
          Disabled
        </button>
        <span id="minus" tabIndex={-1} class="rounded border px-2 py-1">
          tabindex -1
        </span>
        <button id="hidden" type="button" style={{ display: "none" }}>
          Hidden
        </button>
        <div id="div" class="rounded border px-2 py-1">
          Plain div
        </div>
      </div>
      <button id="check" type="button" class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={check}>
        Check
      </button>
      <ul class="font-mono text-xs">
        {ids.map((id) => (
          <li id={"r-" + id}>
            {id}: {results()[id] ?? "?"}
          </li>
        ))}
      </ul>
    </section>
  );
}
// #endregion
