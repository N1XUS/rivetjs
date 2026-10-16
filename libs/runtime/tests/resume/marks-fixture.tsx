// Marker ids left out of the HTML (`<!--r-->`: the stride of the two starts before it, docs/resume.md "Marker ids"):
// runs of text markers before / inside / after a re-created region, a streamed boundary and the content after it.
import { signal } from "@rivetjs/reactivity";
import { Async, For } from "@rivetjs/runtime/server";

const load = (): Promise<string> => (globalThis as { __load?: () => Promise<string> }).__load?.() ?? Promise.resolve("x");
function Count(props: { n: number; k: number }) {
  return <b class="c">{props.n + props.k}</b>;
}

export function Page() {
  const n = signal(1),
    on = signal(true);
  return (
    <main>
      <button id="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
      <button id="flip" onClick={() => on.set(!on())}>
        flip
      </button>
      <div id="head">
        {[0, 1, 2].map((k) => (
          <Count n={n()} k={k} />
        ))}
      </div>
      {on() ? (
        <p id="region">
          {[3, 4].map((k) => (
            <Count n={n()} k={k} />
          ))}
        </p>
      ) : (
        <p id="region">off</p>
      )}
      <div id="tail">
        {[5, 6, 7].map((k) => (
          <Count n={n()} k={k} />
        ))}
      </div>
      <section>
        <Async load={load} fallback={() => <i>wait</i>}>
          {(v: string) => (
            <div id="late" title={v}>
              {[8, 9, 10].map((k) => (
                <Count n={n()} k={k} />
              ))}
            </div>
          )}
        </Async>
      </section>
      <div id="after">
        {[11, 12, 13].map((k) => (
          <Count n={n()} k={k} />
        ))}
      </div>
    </main>
  );
}

// Row markers continue a stride (row regions and their texts); a removed row takes its markers along before the
// segment's rescan, so the rows after it keep the ids the first scan read.
export function Rows() {
  const rows = signal([0, 1, 2, 3]),
    m = signal(0);
  return (
    <main>
      <button id="drop" onClick={() => rows.set(rows().filter((r) => r !== 1))}>
        drop
      </button>
      <button id="bump" onClick={() => m.set(m() + 1)}>
        bump
      </button>
      <ul>
        <For each={rows()} by={(r: number) => r}>
          {(r: () => number) => (
            <li>
              {r()}:{m()}
            </li>
          )}
        </For>
      </ul>
      <section>
        <Async load={load} fallback={() => <i>wait</i>}>
          {(v: string) => <p id="late">{v}</p>}
        </Async>
      </section>
    </main>
  );
}
