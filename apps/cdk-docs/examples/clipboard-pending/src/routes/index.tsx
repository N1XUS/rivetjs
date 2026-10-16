import { signal } from "@rivetjs/reactivity";
import { beginCopy, copyText } from "@rivetjs/cdk/clipboard";

export const head = { title: "Clipboard: beginCopy()" };

// #region demo
export default function Export() {
  const result = signal("Nothing copied yet");
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div class="flex gap-2">
        <button
          id="short"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={() => result.set(copyText("ok") ? "copyText: copied 2 characters" : "copyText: refused")}
        >
          Copy "ok"
        </button>
        <button
          id="long"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={() => {
            const rows = Array.from({ length: 5000 }, (_, i) => `row ${i}`).join("\n");
            // The hidden textarea fills now; copy() can run in a later tick.
            const pending = beginCopy(rows);
            const ok = pending.copy();
            pending.destroy();
            result.set(ok ? `beginCopy: copied ${rows.length} characters` : "beginCopy: refused");
          }}
        >
          Copy 5000 rows
        </button>
      </div>
      <p id="result" role="status" class="text-slate-600">
        {result()}
      </p>
    </section>
  );
}
// #endregion
