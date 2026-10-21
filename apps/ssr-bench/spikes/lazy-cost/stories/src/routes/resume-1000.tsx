import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { load, type PageProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";

// LAZY-FLIP (`../../client.ts`): the ssr-bench `/resume` page (`apps/ssr-bench/router-app/src/routes/resume/index.tsx`,
// body as is) at 1000 rows with in-process data instead of the gRPC fixture: loader data, keyed `<For>` of row-plan rows.
interface Row {
  id: number;
  values: string[];
}

export const loader = load(() => ({
  title: "Resume 1000",
  token: "bench",
  rows: Array.from({ length: 1000 }, (_, i): Row => ({ id: i + 1, values: Array.from({ length: 10 }, (_, k) => `Value ${i + 1}.${k}`) })),
}));

export const head = { title: "Resume 1000" };

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
