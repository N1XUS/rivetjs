import { PAGE_STYLE } from "../fixture/emitter.ts";
import { pipeReact } from "./react-pipe.js";

// react-static: React 19 server rendering of the static fixture page (no handlers, no state, no bootstrap
// script) — the static peer of rivet-compiled / Razor / solid-stable-static. React has no non-hydratable compile
// mode; its server output carries no hydration keys either way.

function Row({ row }) {
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
export function Page({ page, articleHtml }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{page.title}</title>
        <style>{PAGE_STYLE}</style>
      </head>
      <body>
        <main data-token={page.token}>
          <h1>{page.title}</h1>
          {articleHtml ? <div data-article="" dangerouslySetInnerHTML={{ __html: articleHtml }} /> : null}
          <section data-grid="">
            {page.rows.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </section>
        </main>
      </body>
    </html>
  );
}

/** Streams the production React 19 page through `renderToPipeableStream` (react-pipe.js). */
export function renderPage(page, { signal, articleHtml }, sink) {
  return pipeReact(<Page page={page} articleHtml={articleHtml} />, { signal }, sink);
}
