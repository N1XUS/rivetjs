// Portal resume fixture: one portal behind a Show that starts true (server-rendered, moved at load),
// one behind a Show that starts false (created in the browser), one into a selector mount.
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Portal } from "@rivetjs/cdk/portal";

export function Page() {
  const open = signal(true);
  const later = signal(false);
  const count = signal(0);
  return (
    <main>
      <div id="card" style={{ overflow: "hidden", height: "20px" }}>
        <button id="toggle" type="button" onClick={() => open.set(!open())}>toggle</button>
        <button id="later" type="button" onClick={() => later.set(!later())}>later</button>
        <Show when={open}>
          {() => (
            <Portal>
              <div id="notice" role="status">
                Notice {count()} <button id="inc" type="button" onClick={() => count.set(count() + 1)}>inc</button>
              </div>
            </Portal>
          )}
        </Show>
        <Show when={later}>
          {() => (
            <Portal mount="#outlet">
              <p id="late">Late</p>
            </Portal>
          )}
        </Show>
      </div>
      <section id="outlet"></section>
    </main>
  );
}
