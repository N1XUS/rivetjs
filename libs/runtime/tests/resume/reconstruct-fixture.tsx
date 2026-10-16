// Resumed pages: `reconstruct(() => …)` values (Function Bridge T26 / T27) — the browser runs the factory on first
// read, re-runs it (with onCleanup) after a captured signal changes, per For row, inside its providers.
// resume-reconstruct-browser.test.ts (T27 review L2).
import { createContext, onCleanup, signal, useContext } from "@rivetjs/reactivity";
import { For, Provider, reconstruct } from "@rivetjs/runtime/dom";
import { resumableContext } from "@rivetjs/runtime/resume-format";

/** Factory runs and cleanups, in order (read by the test through `import("/fixture.mjs")`). */
export const log: string[] = [];

/** Lazy + reactive: nothing runs at resume; a read runs it; a captured signal change re-runs it on the next read. */
export function Lazy() {
  const url = signal("a");
  const out = signal("");
  const conn = reconstruct(() => {
    const at = url();
    log.push("run:" + at);
    onCleanup(() => log.push("clean:" + at));
    return { at };
  });
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(conn().at)}>
        read
      </button>
      <button class="next" onClick={() => url.set(url() + "+")}>
        next
      </button>
    </section>
  );
}

/** One reconstruct per For row (the row is an accessor), each with its own captures. */
export function Rows() {
  const rows = signal([{ id: "x" }, { id: "y" }]);
  const out = signal("");
  return (
    <section>
      <span class="out">{out()}</span>
      <ul>
        <For each={rows()} by={(row) => row.id}>
          {(row) => {
            const tag = reconstruct(() => {
              log.push("row:" + row().id);
              return "<" + row().id + ">";
            });
            return (
              <li>
                <button class={"go " + row().id} onClick={() => out.set(out() + tag())}>
                  {row().id}
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </section>
  );
}

const Theme = resumableContext(createContext<{ name: string }>({ name: "none" }, { id: "rc-theme" }));

function Themed() {
  const out = signal("");
  const theme = reconstruct(() => {
    log.push("theme");
    return useContext(Theme).name;
  });
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(theme())}>
        read
      </button>
    </section>
  );
}

/** The factory reads a context provided around its component on the server. */
export function Context() {
  return (
    <Provider token={Theme} value={{ name: "dark" }}>
      <Themed />
    </Provider>
  );
}
