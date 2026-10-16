import { signal } from "@rivetjs/reactivity";
import { keyboardProps } from "@rivetjs/cdk/interactions/keyboard";

export const head = { title: "Keyboard shortcuts" };

// #region demo
export default function Note() {
  const saved = signal("nothing");
  const log = signal("");
  const keyboard = keyboardProps({
    shortcuts: {
      // Handled (returns nothing): preventDefault + stop.
      "Shift+Enter": (e) => void saved.set((e.currentTarget as HTMLInputElement).value),
      Escape: (e) => {
        (e.currentTarget as HTMLInputElement).value = "";
        saved.set("(cleared)");
      },
      // false: not handled, the key keeps its default action and propagates.
      "Alt+ArrowUp": () => {
        log.set("Alt+ArrowUp not handled");
        return false;
      },
    },
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <label class="grid gap-1">
        Note (Shift+Enter saves, Escape clears)
        <input id="note" {...keyboard.keyboardProps} class="rounded border border-slate-300 px-2 py-1" />
      </label>
      <p id="saved">Saved: {saved()}</p>
      <output id="log" class="block font-mono text-xs">
        {log()}
      </output>
    </section>
  );
}
// #endregion
