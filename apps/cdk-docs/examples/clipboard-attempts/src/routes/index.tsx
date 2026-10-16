import { signal } from "@rivetjs/reactivity";
import { copyToClipboard, destroyCopyToClipboard } from "@rivetjs/cdk/clipboard";

export const head = { title: "Clipboard: copyToClipboard()" };

const snippet = "pnpm add @rivetjs/cdk";

// #region demo
export default function CopyButton() {
  const log = signal<string[]>([]);
  const add = (line: string) => log.update((lines) => [...lines, line]);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <code id="snippet" class="rounded bg-slate-100 px-2 py-1">
        {snippet}
      </code>
      <div class="flex gap-2">
        <button
          id="copy"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={(event) =>
            // Angular [cdkCopyToClipboard]: retries up to 3 times, then calls copied() once.
            copyToClipboard(event.currentTarget, { text: snippet, attempts: 3, copied: (ok) => add(ok ? "copied" : "refused") })
          }
        >
          Copy (3 attempts)
        </button>
        <button
          id="cancel"
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1"
          onClick={(event) => {
            const trigger = event.currentTarget.ownerDocument.getElementById("copy");
            if (trigger) destroyCopyToClipboard(trigger);
            add("retries cancelled");
          }}
        >
          Cancel retries
        </button>
      </div>
      <ol id="log" aria-label="Copy results" class="list-decimal ps-6 text-slate-600">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </section>
  );
}
// #endregion
