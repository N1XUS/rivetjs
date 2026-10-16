import { For, createResource, createSignal } from "solid-js";
import { HydrationScript, renderToStream } from "solid-js/web";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";
import { PAGE_STYLE } from "../fixture/emitter.ts";

// solid-stable-interactive: the like-for-like hydratable peer of rivet-resume (router-app/src/routes/resume):
// same nested layout (state + handler + two links), keyed rows with a click handler, a signal-driven attribute
// and a per-row link, and the page data shipped to the browser (a resource: Solid serializes it with seroval
// for hydration, as Rivet ships it in its resume state). Links are plain `<a href>`: Solid's `<A>` needs
// @solidjs/router (not in apps/bench-stable), and Rivet's server `<Link>` renders a bare `<a>` here too.

function Row(props) {
  return (
    <article data-row={props.row.id} data-state={props.selected() === props.row.id ? "selected" : "even"}>
      <header>
        <h2>
          <a href={"/resume?rows=" + props.row.id}>Record</a>
        </h2>
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
        <button type="button" onClick={() => props.select(props.row.id)}>
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
function Layout(props) {
  const [visits, setVisits] = createSignal(0);
  return (
    <div data-lane="solid-stable-interactive">
      <div data-layout="resume">
        <nav>
          <a href="/resume?rows=10">Ten rows</a> <a href="/page">Static page</a>{" "}
          <button type="button" onClick={() => setVisits((n) => n + 1)}>
            Visits {visits()}
          </button>
        </nav>
        {props.children}
      </div>
    </div>
  );
}
function Content(props) {
  const [selected, setSelected] = createSignal(-1);
  // The loader result as hydration data: serialized into the stream for the client to read back.
  const [page] = createResource(() => props.page);
  return (
    <main data-token={page().token}>
      <h1>{page().title}</h1>
      <section data-grid="">
        <For each={page().rows}>{(row) => <Row row={row} selected={selected} select={setSelected} />}</For>
      </section>
    </main>
  );
}
export function Page(props) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{props.page.title}</title>
        <style>{PAGE_STYLE}</style>
        <HydrationScript />
      </head>
      <body>
        <Layout>
          <Content page={props.page} />
        </Layout>
      </body>
    </html>
  );
}

/** Streams production Solid 1 JSX through its public WritableStream API (as solid-stable). */
export async function renderPage(page, { signal }, sink) {
  signal?.throwIfAborted();
  let failure;
  const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
  // Solid closes this wrapper; the HTTP response stays open for its shared completion marker.
  const destination = new WritableStream({
    write: (chunk) => writer.writeBytes(chunk),
    close: () => writer.finish(),
  });
  const rendering = renderToStream(() => <Page page={page} />, {
    onError: (error) => {
      failure = error;
    },
  });
  await rendering.pipeTo(destination);
  // Solid 1 resolves pipeTo after initiating close; propagate pending writes and writer failures.
  const completed = destination.getWriter();
  try {
    await completed.closed;
  } finally {
    completed.releaseLock();
  }
  if (failure) throw failure;
}
