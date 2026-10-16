import { signal } from "@rivetjs/reactivity";
import { createKeyboardShortcutHandler } from "@rivetjs/cdk/keys";

export const head = { title: "Keyboard shortcuts" };

// #region demo
export default function Editor() {
  const log = signal<string[]>([]);
  const text = signal("");
  const add = (line: string): void => void log.update((lines) => [...lines.slice(-4), line]);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <label class="grid gap-1">
        Draft
        <textarea
          id="draft"
          rows={3}
          class="rounded border border-slate-300 p-2"
          onInput={(event) => text.set(event.currentTarget.value)}
          onKeyDown={(event) =>
            // Bindings are matched exactly (modifiers + key). Handled keys get preventDefault().
            createKeyboardShortcutHandler({
              "Mod+s": () => add("save"),
              "Control+Shift+z": () => add("redo"),
              "Alt+ArrowDown": () => add("move line down"),
              Escape: () => add("cancel"),
              // false = not handled: Enter still types a newline unless the draft is empty.
              Enter: () => {
                if (text().trim()) return false;
                add("empty: Enter blocked");
              },
            })(event)
          }
        />
      </label>
      <ul class="font-mono text-xs text-slate-600">
        <li>Mod+S save · Control+Shift+Z redo · Alt+↓ move · Escape cancel · Enter (blocked while empty)</li>
      </ul>
      <ol id="log" aria-label="Shortcuts run" class="list-decimal ps-6">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </section>
  );
}
// #endregion
