import { batch, signal } from "@rivetjs/reactivity";
import { mount as mountDOM } from "@rivetjs/runtime/dom";

let stop = null;
let fields = [];

function Field({ index }) {
  const revision = signal(0);
  fields[index] = revision;
  return (
    <label class="field">
      <span class="caption">{`Field ${index % 10}`}</span>
      <strong data-field={index}>{`value-${index}-${revision()}`}</strong>
      <button type="button" data-action={index} onClick={() => revision.update((value) => value + 1)}>
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
      <div class="fields">
        {Array.from({ length: 10 }, (_, offset) => (
          <Field index={index * 10 + offset} />
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
  stop = mountDOM(
    () => (
      <main>
        {Array.from({ length: rows }, (_, index) => (
          <Row index={index} />
        ))}
      </main>
    ),
    document.querySelector("#host"),
  );
}

/** Apply selected field revisions and synchronously commit their DOM changes. */
function update(indices, revision) {
  batch(() => {
    for (const index of indices) fields[index].set(revision);
  });
}

/** Remove the page and release all adapter state; repeated calls are safe. */
function dispose() {
  const previous = stop;
  stop = null;
  try {
    previous?.();
  } finally {
    fields = [];
  }
}

window.bench = { mount, update, dispose };
