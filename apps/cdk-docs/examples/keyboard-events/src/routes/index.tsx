import { signal } from "@rivetjs/reactivity";
import { keyboardProps } from "@rivetjs/cdk/interactions/keyboard";

export const head = { title: "keyboardProps" };

// #region demo
export default function Note() {
  const log = signal<string[]>([]);
  const parent = signal(0);
  const off = signal(false);
  const keyboard = keyboardProps({
    isDisabled: off,
    onKeyDown: (e) => {
      log.update((l) => [...l, "down:" + e.key]);
      // Stopped by default; arrow keys go on to the form.
      if (e.key.startsWith("Arrow")) e.continuePropagation();
    },
    onKeyUp: (e) => log.update((l) => [...l, "up:" + e.key]),
  });
  return (
    <form class="m-4 grid max-w-md gap-3 text-sm" onKeyDown={() => parent.update((n) => n + 1)} onSubmit={(e) => e.preventDefault()}>
      <label class="grid gap-1">
        Note
        <input id="note" {...keyboard.keyboardProps} class="rounded border border-slate-300 px-2 py-1" />
      </label>
      <button id="off" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1" onClick={() => off.set(true)}>
        Turn off
      </button>
      <p id="parent">Form saw {parent()} keys</p>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
    </form>
  );
}
// #endregion
