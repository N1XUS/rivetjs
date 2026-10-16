// ActionBar "clear selection" over a DataGrid on a resumed page, shaped like the ui-docs `action-bar-with-data-grid` example:
// DataGrid `#abcg-grid` over a `rows` signal with selection checkboxes and a two-way `selectedKeys` signal, bar `#abcg`
// (count `#abcg-count`, `#abcg-archive` removes the selected rows, `#abcg-clear` = X).
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { DataGrid } from "@rivetjs/ui/data-grid";
import type { DataGridSelection } from "@rivetjs/ui/data-grid";
import { Archive, X } from "lucide";

interface Customer {
  id: number;
  name: string;
  city: string;
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: "Harbour Coffee", city: "Leith" },
  { id: 2, name: "Moss & Pine", city: "Bergen" },
  { id: 3, name: "Quill Studio", city: "Porto" },
  { id: 4, name: "Lumen Optics", city: "Graz" },
];

export function GridDemo() {
  const rows = signal(CUSTOMERS);
  const selected = signal<DataGridSelection>(new Set());
  const count = computed(() => (selected() === "all" ? rows().length : (selected() as Set<number>).size));
  const columns = [
    { id: "name", header: "Customer", accessorKey: "name" as const },
    { id: "city", header: "City", accessorKey: "city" as const },
  ];
  return (
    <div class="w-[520px]">
      <DataGrid<Customer>
        id="abcg-grid"
        aria-label="Customers"
        data={rows}
        columns={columns}
        selectionMode="multiple"
        showSelectionCheckboxes
        selectedKeys={selected}
      />
      <ActionBar id="abcg" isOpen={() => count() > 0} aria-label="Customer actions">
        <ActionBar.Prefix>
          <span id="abcg-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button
            id="abcg-archive"
            variant="ghost"
            size="sm"
            onPress={() => {
              const sel = selected();
              rows.set(sel === "all" ? [] : rows().filter((c) => !sel.has(c.id)));
              selected.set(new Set());
            }}
          >
            <Icon icon={Archive} size={16} />
            <span class="action-bar__label">Archive</span>
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button id="abcg-clear" variant="ghost" size="sm" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            <Icon icon={X} size={16} />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  );
}

export default function ActionBarClearGrid() {
  return (
    <main class="p-6">
      <GridDemo />
    </main>
  );
}
