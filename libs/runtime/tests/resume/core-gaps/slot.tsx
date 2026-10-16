// CORE-GAPS (a): a conditional `r:slot` child toggles the named slot's content (and its fallback).
import { signal } from "@rivetjs/reactivity";

function Card(props: { header?: unknown; children?: unknown }) {
  return (
    <article class="card">
      <slot r:name="header">
        <h2 class="fallback">Untitled</h2>
      </slot>
      <div class="body">
        <slot />
      </div>
    </article>
  );
}

export function Page() {
  const on = signal(false);
  return (
    <div>
      <Card>
        {on() && (
          <h2 r:slot="header" class="title">
            Title
          </h2>
        )}
        <p>Body</p>
      </Card>
      <button class="go" onClick={() => on.set(!on())}>
        toggle
      </button>
    </div>
  );
}
