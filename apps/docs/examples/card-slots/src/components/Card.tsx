import { signal } from "@rivetjs/reactivity";
import type { Content, Slot, Slots } from "@rivetjs/runtime/jsx-runtime";

// #region demo
export interface CardProps extends Slots<"header" | "footer"> {
  rows: readonly string[];
  /** A scoped slot: the card calls it once per row, with the row's text and index. */
  row?: Slot<[text: () => string, index: () => number]>;
  children?: Content;
}

export function Card({ header, footer, row, rows, children }: CardProps) {
  const open = signal(false);
  return (
    <article class="grid gap-2 rounded-lg border border-slate-200 p-3">
      <header class="flex items-center justify-between gap-2">
        {/* Named slot with fallback content. */}
        <slot r:name="header">
          <h2 class="font-semibold">Untitled card</h2>
        </slot>
        <button type="button" class="rounded border border-slate-300 px-2" onClick={() => open.update((v) => !v)}>
          {open() ? "Hide" : "Show"} rows
        </button>
      </header>
      {/* Default slot: the children. */}
      <slot />
      {open() ? (
        <ul class="list-disc pl-5">
          {rows.map((text, i) => (
            <slot r:name="row" r:args={[() => text, () => i]}>
              <li>{text}</li>
            </slot>
          ))}
        </ul>
      ) : (
        <p class="text-slate-500">Rows hidden</p>
      )}
      <footer class="text-xs text-slate-500">
        <slot r:name="footer">No footer</slot>
      </footer>
    </article>
  );
}
// #endregion
