import { signal } from "@rivetjs/reactivity";
import { canonicalKeyboardShortcut, keyboardEventToCanonicalShortcut, parseKeyboardShortcut } from "@rivetjs/cdk/keys";

export const head = { title: "Parse shortcuts" };

// #region demo
export default function Parse() {
  const spec = signal("shift+Mod+K");
  const pressed = signal("Press keys in the field");
  const parsed = () => {
    try {
      const shortcut = parseKeyboardShortcut(spec());
      return { canonical: canonicalKeyboardShortcut(shortcut), detail: JSON.stringify(shortcut) };
    } catch (error) {
      return { canonical: "error", detail: (error as Error).message };
    }
  };
  return (
    <section class="m-4 grid max-w-xl gap-2 text-sm">
      <label class="grid gap-1">
        Shortcut string
        <input id="spec" class="rounded border border-slate-300 px-2 py-1 font-mono" value={spec()} onInput={(event) => spec.set(event.currentTarget.value)} />
      </label>
      <p id="canonical">Canonical: {parsed().canonical}</p>
      <p id="detail" class="font-mono text-xs text-slate-600">
        {parsed().detail}
      </p>
      <label class="grid gap-1">
        Record a key event
        <input
          id="record"
          class="rounded border border-slate-300 px-2 py-1"
          onKeyDown={(event) => {
            event.preventDefault();
            pressed.set(keyboardEventToCanonicalShortcut(event));
          }}
        />
      </label>
      <p id="pressed">Event: {pressed()}</p>
    </section>
  );
}
// #endregion
