import { For, renderToStream } from "@solidjs/web";
import { Writable } from "node:stream";
import { PAGE_STYLE } from "../fixture/emitter.ts";

function Row(props) {
  return (
    <article data-row={props.row.id} data-state="even">
      <header>
        <h2>Record</h2>
        <p>Static description and supporting HTML.</p>
      </header>
      <section>
        <dl>
          <div>
            <dt>Field 0</dt>
            <dd>{props.row.values[0]}</dd>
          </div>
          <div>
            <dt>Field 1</dt>
            <dd>{props.row.values[1]}</dd>
          </div>
          <div>
            <dt>Field 2</dt>
            <dd>{props.row.values[2]}</dd>
          </div>
          <div>
            <dt>Field 3</dt>
            <dd>{props.row.values[3]}</dd>
          </div>
          <div>
            <dt>Field 4</dt>
            <dd>{props.row.values[4]}</dd>
          </div>
          <div>
            <dt>Field 5</dt>
            <dd>{props.row.values[5]}</dd>
          </div>
          <div>
            <dt>Field 6</dt>
            <dd>{props.row.values[6]}</dd>
          </div>
          <div>
            <dt>Field 7</dt>
            <dd>{props.row.values[7]}</dd>
          </div>
          <div>
            <dt>Field 8</dt>
            <dd>{props.row.values[8]}</dd>
          </div>
          <div>
            <dt>Field 9</dt>
            <dd>{props.row.values[9]}</dd>
          </div>
        </dl>
      </section>
      <footer>
        <button type="button" disabled>
          Increment
        </button>
        <label>
          Selected
          <input type="checkbox" readonly />
        </label>
      </footer>
    </article>
  );
}
function Page(props) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{props.page.title}</title>
        <style>{PAGE_STYLE}</style>
      </head>
      <body>
        <main data-token={props.page.token}>
          <h1>{props.page.title}</h1>
          {props.articleHtml && <div data-article="" innerHTML={props.articleHtml} />}
          <section data-grid="">
            <For each={props.page.rows}>{(row) => <Row row={row} />}</For>
          </section>
        </main>
      </body>
    </html>
  );
}

/** Streams production Solid 2 JSX output through its public backpressured Web stream API. */
export async function renderPage(page, { signal, articleHtml }, sink) {
  let failure;
  const rendering = renderToStream(() => <Page page={page} articleHtml={articleHtml} />, {
    signal,
    onError: (error) => {
      failure = error;
    },
  });
  await rendering.readable.pipeTo(Writable.toWeb(sink), { preventClose: true, signal });
  if (failure) throw failure;
}
