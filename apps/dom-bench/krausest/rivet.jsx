// Rivet lane of the krausest-style suite (keyed). This is an adapter: it may use any public Rivet API.
// Branches that change the API update this file; the harness only relies on the DOM contract
// (#run #runlots #add #update #clear #swaprows buttons, tbody rows, td:nth(2)>a select, td:nth(3)>a remove, tr.danger).
import { batch, selector, signal } from "@rivetjs/reactivity";
import { For, mount } from "@rivetjs/runtime/dom";
import { label } from "./words.js";

let nextId = 1;
const build = (count) => {
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = { id: nextId++, label: signal(label()) };
  return out;
};

function Button(props) {
  return (
    <div class="col-sm-6 smallpad">
      <button type="button" class="btn btn-primary btn-block" id={props.id} onClick={props.fn}>
        {props.text}
      </button>
    </div>
  );
}

function App() {
  const rows = signal([]);
  // Selection as Solid's krausest implementation does it (createSelector): one signal, a row re-renders only
  // when its own selected state changes.
  const selected = signal(null);
  const isSelected = selector(selected);
  const select = (row) => selected.set(row.id);
  const remove = (row) => {
    const list = rows().slice();
    list.splice(list.indexOf(row), 1);
    rows.set(list);
  };
  const run = () => {
    rows.set(build(1000));
  };
  const runLots = () => {
    rows.set(build(10000));
  };
  const add = () => rows.set(rows().concat(build(1000)));
  const update = () =>
    batch(() => {
      const list = rows();
      for (let i = 0; i < list.length; i += 10) list[i].label.update((value) => value + " !!!");
    });
  const clear = () => {
    rows.set([]);
  };
  const swapRows = () => {
    const list = rows().slice();
    if (list.length > 998) {
      const row = list[1];
      list[1] = list[998];
      list[998] = row;
      rows.set(list);
    }
  };
  return (
    <div class="container">
      <div class="jumbotron">
        <div class="row">
          <div class="col-md-6">
            <h1>Rivet-"keyed"</h1>
          </div>
          <div class="col-md-6">
            <div class="row">
              <Button id="run" text="Create 1,000 rows" fn={run} />
              <Button id="runlots" text="Create 10,000 rows" fn={runLots} />
              <Button id="add" text="Append 1,000 rows" fn={add} />
              <Button id="update" text="Update every 10th row" fn={update} />
              <Button id="clear" text="Clear" fn={clear} />
              <Button id="swaprows" text="Swap Rows" fn={swapRows} />
            </div>
          </div>
        </div>
      </div>
      <table class="table table-hover table-striped test-data">
        <tbody>
          <For each={rows}>
            {(item) => {
              const row = item(),
                id = row.id;
              return (
                <tr class={isSelected(row.id) ? "danger" : ""}>
                  <td class="col-md-1">{id}</td>
                  <td class="col-md-4">
                    <a onClick={() => select(row)}>{row.label()}</a>
                  </td>
                  <td class="col-md-1">
                    <a onClick={() => remove(row)}>
                      <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                    </a>
                  </td>
                  <td class="col-md-6" />
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
      <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
    </div>
  );
}

mount(() => <App />, document.getElementById("main"));
