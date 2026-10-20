import type { PageProps, RequestEvent } from "@rivetjs/router";
import type { Row } from "../../../services/page-decoder.ts";
import { loadBenchPage } from "../content.server.ts";
import { load } from "@rivetjs/router";

// Same request contract as `server.ts` `/page`: rows / delay_ms / token bounds → 400.
export const loader = load((event: RequestEvent) => loadBenchPage(event));

export const head = ({ data }: { data: { title: string } }) => ({ title: data.title });

function Record({ row }: { row: Row }) {
  if (!Array.isArray(row.values) || row.values.length !== 10) throw new Error("A row requires ten field values");
  return (
    <article data-row={row.id} data-state="even">
      <header>
        <h2>Record</h2>
        <p>Static description and supporting HTML.</p>
      </header>
      <section>
        <dl>
          <div>
            <dt>Field 0</dt>
            <dd>{row.values[0]}</dd>
          </div>
          <div>
            <dt>Field 1</dt>
            <dd>{row.values[1]}</dd>
          </div>
          <div>
            <dt>Field 2</dt>
            <dd>{row.values[2]}</dd>
          </div>
          <div>
            <dt>Field 3</dt>
            <dd>{row.values[3]}</dd>
          </div>
          <div>
            <dt>Field 4</dt>
            <dd>{row.values[4]}</dd>
          </div>
          <div>
            <dt>Field 5</dt>
            <dd>{row.values[5]}</dd>
          </div>
          <div>
            <dt>Field 6</dt>
            <dd>{row.values[6]}</dd>
          </div>
          <div>
            <dt>Field 7</dt>
            <dd>{row.values[7]}</dd>
          </div>
          <div>
            <dt>Field 8</dt>
            <dd>{row.values[8]}</dd>
          </div>
          <div>
            <dt>Field 9</dt>
            <dd>{row.values[9]}</dd>
          </div>
        </dl>
      </section>
      <footer>
        <button type="button" disabled>
          Increment
        </button>
        <label>
          Selected
          <input type="checkbox" readOnly />
        </label>
      </footer>
    </article>
  );
}

export default function BenchPage({ data }: PageProps<typeof loader>) {
  return (
    <main data-token={data.token}>
      <h1>{data.title}</h1>
      <section data-grid="">
        {data.rows.map((row) => (
          <Record row={row} />
        ))}
      </section>
    </main>
  );
}
