import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

export const head = { title: "Plan rows 1000" };

interface Customer {
  id: number;
  name: string;
  mail: string;
}

// Row-plan rows (`$rows`: one native template, `_rOn` / `_rAttr` sites) over 1000 customers: the lazy tape path
// (`lazyPlanRows`); with `domData` the names / mails are the cells' whole text (DOM-DATA tape registration).
export default function PlanRows1000() {
  const customers: Customer[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1} Holdings & Co`,
    mail: `customer.${i + 1}@example.com`,
  }));
  const picked = signal(-1);
  return (
    <section>
      <table>
        <tbody>
          <For each={() => customers} by={(c) => c.id}>
            {(c) => (
              <tr data-id={c().id} class={picked() === c().id ? "on" : "off"}>
                <td>{c().name}</td>
                <td>{c().mail}</td>
                <td>
                  <button type="button" onClick={() => picked.set(c().id)}>
                    Pick
                  </button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <p id="picked">{picked()}</p>
    </section>
  );
}
