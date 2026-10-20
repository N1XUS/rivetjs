import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
import type { Row } from "../../../../services/page-decoder.ts";
import { loadBenchPage } from "../../content.server.ts";
import { load } from "@rivetjs/router";

// rivet-resume lane (`/resume`): the bench page as an interactive resumable app — keyed `<For>` rows, a
// reactive attribute + click handler per row, a per-row `<Link>`, nested layout. The row data reaches the
// browser through Rivet's own resume state (like Solid's hydration keys / Qwik's container state).
export const loader = load((event: RequestEvent) => loadBenchPage(event));

export const head = ({ data }: { data: { title: string } }) => ({ title: data.title });

export default function ResumePage({ data }: PageProps<typeof loader>) {
  const selected = signal(-1);
  return (
    <main data-token={data.token}>
      <h1>{data.title}</h1>
      <section data-grid="">
        <For each={() => data.rows} by={(row: Row) => row.id}>
          {(row: () => Row) => (
            <article data-row={row().id} data-state={selected() === row().id ? "selected" : "even"}>
              <header>
                <h2>
                  <Link to={"/resume?rows=" + row().id}>Record</Link>
                </h2>
                <p>Static description and supporting HTML.</p>
              </header>
              <section>
                <dl>
                  <div>
                    <dt>Field 0</dt>
                    <dd>{row().values[0]}</dd>
                  </div>
                  <div>
                    <dt>Field 1</dt>
                    <dd>{row().values[1]}</dd>
                  </div>
                  <div>
                    <dt>Field 2</dt>
                    <dd>{row().values[2]}</dd>
                  </div>
                  <div>
                    <dt>Field 3</dt>
                    <dd>{row().values[3]}</dd>
                  </div>
                  <div>
                    <dt>Field 4</dt>
                    <dd>{row().values[4]}</dd>
                  </div>
                  <div>
                    <dt>Field 5</dt>
                    <dd>{row().values[5]}</dd>
                  </div>
                  <div>
                    <dt>Field 6</dt>
                    <dd>{row().values[6]}</dd>
                  </div>
                  <div>
                    <dt>Field 7</dt>
                    <dd>{row().values[7]}</dd>
                  </div>
                  <div>
                    <dt>Field 8</dt>
                    <dd>{row().values[8]}</dd>
                  </div>
                  <div>
                    <dt>Field 9</dt>
                    <dd>{row().values[9]}</dd>
                  </div>
                </dl>
              </section>
              <footer>
                <button type="button" onClick={() => selected.set(row().id)}>
                  Increment
                </button>
                <label>
                  Selected
                  <input type="checkbox" readOnly />
                </label>
              </footer>
            </article>
          )}
        </For>
      </section>
    </main>
  );
}
