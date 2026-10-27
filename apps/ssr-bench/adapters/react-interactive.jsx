import { useState } from "react";
import { PAGE_STYLE } from "../fixture/emitter.ts";
import { pipeReact } from "./react-pipe.js";

// react-interactive: the like-for-like hydratable React 19 peer of rivet-resume (router-app/src/routes/resume) and
// solid-stable-interactive: same nested layout (state + handler + two links), keyed rows with a click handler, a
// state-driven attribute and a per-row link, the page data shipped to the browser for `hydrateRoot` (JSON in an
// inline bootstrap script — React has no data serializer outside Server Components) and the client bootstrap
// script tag. Links are plain `<a href>` (no router in the lane, as solid-stable-interactive). The client bundle
// itself is not built or served: the lane measures the server's work only.

/** JSON for an inline script: `<` escaped so no data value can close the script element. */
const scriptJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function Row({ row, selected, select }) {
  return (
    <article data-row={row.id} data-state={selected === row.id ? "selected" : "even"}>
      <header>
        <h2>
          <a href={"/resume?rows=" + row.id}>Record</a>
        </h2>
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
        <button type="button" onClick={() => select(row.id)}>
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
function Layout({ children }) {
  const [visits, setVisits] = useState(0);
  return (
    <div data-lane="react-interactive">
      <div data-layout="resume">
        <nav>
          <a href="/resume?rows=10">Ten rows</a> <a href="/page">Static page</a>{" "}
          <button type="button" onClick={() => setVisits((n) => n + 1)}>
            Visits {visits}
          </button>
        </nav>
        {children}
      </div>
    </div>
  );
}
function Content({ page }) {
  const [selected, setSelected] = useState(-1);
  return (
    <main data-token={page.token}>
      <h1>{page.title}</h1>
      <section data-grid="">
        {page.rows.map((row) => (
          <Row key={row.id} row={row} selected={selected} select={setSelected} />
        ))}
      </section>
    </main>
  );
}
export function Page({ page }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{page.title}</title>
        <style>{PAGE_STYLE}</style>
      </head>
      <body>
        <Layout>
          <Content page={page} />
        </Layout>
      </body>
    </html>
  );
}

/** Streams the production React 19 page; the loader data travels as hydration data in `bootstrapScriptContent`,
 * followed by the client entry's `<script async>` (`bootstrapScripts`). */
export function renderPage(page, { signal }, sink) {
  return pipeReact(
    <Page page={page} />,
    { signal, bootstrapScriptContent: `window.__PAGE__=${scriptJson(page)}`, bootstrapScripts: ["/assets/react-client.js"] },
    sink,
  );
}
