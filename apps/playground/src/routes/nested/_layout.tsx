// Demo: a nested layout stays mounted while navigation stays below it (/nested/one ↔ /nested/two):
// its counter and the input keep their state, its loader is skipped (the `loads` count stays) and
// `url()` follows. Leaving /nested disposes it.
import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

let loads = 0;
export const loader = load(() => ({ loads: ++loads }));

export default function NestedLayout({ data, url, children }: LayoutProps<typeof loader>) {
  const count = signal(0);
  return (
    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-sm text-slate-600">
        Nested layout · loader runs: <span id="nested-loads">{data().loads}</span> · at <span id="nested-url">{url().pathname}</span>
      </p>
      <div class="mt-3 flex items-center gap-4">
        <button type="button" id="nested-count" class="rounded border px-3 py-1" onClick={() => count.update((n) => n + 1)}>
          Kept {count()}
        </button>
        <input id="nested-input" class="rounded border px-2 py-1" placeholder="Type, then switch tabs" />
      </div>
      <nav class="mt-3 flex gap-4 text-teal-700">
        <a href="/nested/one">One</a> <a href="/nested/two">Two</a> <a href="/">Leave</a>
      </nav>
      <div class="mt-4">{children}</div>
    </section>
  );
}
