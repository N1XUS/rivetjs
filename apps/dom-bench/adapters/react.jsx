import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

let root = null;
let fields = [];

function Field({ index }) {
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    fields[index] = setRevision;
    return () => {
      fields[index] = undefined;
    };
  }, [index]);
  return (
    <label className="field">
      <span className="caption">{`Field ${index % 10}`}</span>
      <strong data-field={index}>{`value-${index}-${revision}`}</strong>
      <button type="button" data-action={index} onClick={() => flushSync(() => setRevision((value) => value + 1))}>
        <span>Increase</span>
      </button>
    </label>
  );
}

function Row({ index }) {
  return (
    <section data-row={index}>
      <header>
        <h2>{`Row ${index}`}</h2>
        <p>Ten independent reactive fields in a substantial page.</p>
      </header>
      <div className="fields">
        {Array.from({ length: 10 }, (_, offset) => (
          <Field key={offset} index={index * 10 + offset} />
        ))}
      </div>
      <footer>
        <small>End of row</small>
      </footer>
    </section>
  );
}

/** Mount a fresh page with ten independently reactive fields per row. */
function mount(rows) {
  dispose();
  fields = new Array(rows * 10);
  root = createRoot(document.querySelector("#host"));
  flushSync(() =>
    root.render(
      <main>
        {Array.from({ length: rows }, (_, index) => (
          <Row key={index} index={index} />
        ))}
      </main>,
    ),
  );
}

/** Apply selected field revisions and synchronously commit their DOM changes. */
function update(indices, revision) {
  flushSync(() => {
    for (const index of indices) fields[index](revision);
  });
}

/** Remove the page and release all adapter state; repeated calls are safe. */
function dispose() {
  const previous = root;
  root = null;
  try {
    if (previous) flushSync(() => previous.unmount());
  } finally {
    fields = [];
  }
}

window.bench = { mount, update, dispose };
