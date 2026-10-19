import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { LazyRowsViews } from "../lazy-rows-views.tsx";

export const head = { title: "Lazy collection rows" };

// LAZY-ROWS (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md): every cdk collection row kind with
// 100 rows. `#lr-*`: plain collections (the lazy-rows measurements, T6). `#ls-*`: the same collections with seeded row
// id scopes, server-rendered; `#lazy-rows-mount` renders that seeded copy in the browser into `#lazy-rows-client` — the
// byte-equal id test compares the two (tests-components/lazy-rows.test.ts).
export default function LazyRowsStory() {
  const mounted = signal(false);
  return (
    <section>
      <h1>Lazy collection rows</h1>
      <div id="lazy-rows-plain">
        <LazyRowsViews count={100} prefix="lr" />
      </div>
      <div id="lazy-rows-seeded">
        <LazyRowsViews count={100} prefix="ls" seeded />
      </div>
      <button id="lazy-rows-mount" type="button" onClick={() => mounted.set(true)}>
        Render in the browser
      </button>
      <Show when={mounted}>
        {() => (
          <div id="lazy-rows-client">
            <LazyRowsViews count={100} prefix="ls" seeded />
          </div>
        )}
      </Show>
    </section>
  );
}
