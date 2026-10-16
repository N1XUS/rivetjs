// Port of the Angular Material "table drag-drop" example (angular/components src/components-examples/material/table/table-drag-drop), MIT, © Google LLC — on a plain <table>.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Sortable table rows" };

// #region demo
const ELEMENTS = [
  { position: 1, name: "Hydrogen", weight: 1.0079, symbol: "H" },
  { position: 2, name: "Helium", weight: 4.0026, symbol: "He" },
  { position: 3, name: "Lithium", weight: 6.941, symbol: "Li" },
  { position: 4, name: "Beryllium", weight: 9.0122, symbol: "Be" },
  { position: 5, name: "Boron", weight: 10.811, symbol: "B" },
  { position: 6, name: "Carbon", weight: 12.0107, symbol: "C" },
];

export default function DragDropTable() {
  const rows = signal(ELEMENTS);
  return (
    <table class="example-table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Name</th>
          <th>Weight</th>
          <th>Symbol</th>
        </tr>
      </thead>
      <DropList
        id="rows"
        elementType="tbody"
        lockAxis="y"
        onDropped={(event) => {
          const next = rows().slice();
          moveItemInArray(next, event.previousIndex, event.currentIndex);
          rows.set(next);
        }}
      >
        <For each={rows} by={(row) => row.symbol}>
          {(row) => (
            <Drag id={"row-" + row().symbol} elementType="tr">
              <td>{row().position}</td>
              <td>{row().name}</td>
              <td>{row().weight}</td>
              <td>{row().symbol}</td>
            </Drag>
          )}
        </For>
      </DropList>
    </table>
  );
}
// #endregion
