import { signal } from "@rivetjs/reactivity";
import { isCtrlKeyPressed, isMac, isVirtualClick } from "@rivetjs/cdk/platform";

export const head = { title: "Command modifier and virtual clicks" };

// #region demo
export default function Shortcuts() {
  const status = signal("Type, then press the command key + S");
  const click = signal("Not clicked yet");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <label class="grid gap-1">
        Note
        <textarea
          id="note"
          rows={2}
          class="rounded border border-slate-300 p-2"
          onKeyDown={(event) => {
            // Meta on macOS / iOS, Control elsewhere.
            if (event.key === "s" && isCtrlKeyPressed(event)) {
              event.preventDefault();
              status.set(`Saved with ${isMac() ? "⌘" : "Ctrl"}+S`);
            }
          }}
        />
      </label>
      <p id="status" role="status">
        {status()}
      </p>
      <button
        id="target"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={(event) => click.set(isVirtualClick(event) ? "Virtual click (keyboard or assistive technology)" : "Pointer click")}
      >
        Click me with the mouse, then with Enter
      </button>
      <p id="click">{click()}</p>
    </section>
  );
}
// #endregion
