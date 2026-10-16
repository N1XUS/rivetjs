// Hand-lowered DOM v2 output for adapters/rivet.jsx: the exact shape the v2 compiler lowering targets
// (static values written once, generated firstChild/nextSibling walks, delegated events, plain
// component calls). A/B lane against the v1 compiled `rivet` lane until the compiler emits it.
import { batch, signal } from "@rivetjs/reactivity";
import { render, _tpl, _c, _fx, _t, _textValue, _setAttr, _on, _insert } from "@rivetjs/runtime/dom";

const t0 = _tpl('<label class="field"><span class="caption"></span><strong></strong><button type="button"><span>Increase</span></button></label>'),
  t1 = _tpl("<section><header><h2></h2><p>Ten independent reactive fields in a substantial page.</p></header><div class=\"fields\"></div><footer><small>End of row</small></footer></section>"),
  t2 = _tpl("<main></main>");

let stop = null;
let fields = [];

function Field({ index }) {
  const revision = signal(0);
  fields[index] = revision;
  const el = t0(),
    caption = el.firstChild,
    strong = caption.nextSibling,
    button = strong.nextSibling;
  _textValue(caption, `Field ${index % 10}`);
  _setAttr(strong, "data-field", index);
  _fx(() => _t(strong, `value-${index}-${revision()}`));
  _setAttr(button, "data-action", index);
  _on(button, "click", () => revision.update((value) => value + 1));
  return el;
}

function Row({ index }) {
  const el = t1(),
    header = el.firstChild,
    fieldsEl = header.nextSibling;
  _setAttr(el, "data-row", index);
  _textValue(header.firstChild, `Row ${index}`);
  _insert(fieldsEl, () => Array.from({ length: 10 }, (_, offset) => _c(Field, { index: index * 10 + offset })));
  return el;
}

/** Mount a fresh page with ten independently reactive fields per row. */
function mount(rows) {
  dispose();
  fields = new Array(rows * 10);
  stop = render(() => {
    const el = t2();
    _insert(el, () => Array.from({ length: rows }, (_, index) => _c(Row, { index })));
    return el;
  }, document.querySelector("#host"));
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
