// Rivet-authored ActionBar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { DataGrid } from "@rivetjs/ui/data-grid";
import type { DataGridSelection } from "@rivetjs/ui/data-grid";
import { Archive, Mail, X } from "lucide";

export const head = { title: "ActionBar: With Data Grid" };

// #region demo
interface Customer {
  id: number;
  name: string;
  plan: string;
  city: string;
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: "Harbour Coffee", plan: "Pro", city: "Leith" },
  { id: 2, name: "Moss & Pine", plan: "Starter", city: "Bergen" },
  { id: 3, name: "Quill Studio", plan: "Pro", city: "Porto" },
  { id: 4, name: "Lumen Optics", plan: "Enterprise", city: "Graz" },
  { id: 5, name: "Tidewater Bikes", plan: "Starter", city: "Cork" },
];

export function WithDataGrid() {
  const rows = signal(CUSTOMERS);
  const selected = signal<DataGridSelection>(new Set());
  const count = computed(() => (selected() === "all" ? rows().length : (selected() as Set<number>).size));
  const columns = [
    { id: "name", header: "Customer", accessorKey: "name" as const },
    { id: "plan", header: "Plan", accessorKey: "plan" as const },
    { id: "city", header: "City", accessorKey: "city" as const },
  ];
  return (
    <div class="w-[520px]">
      <DataGrid<Customer> aria-label="Customers" data={rows} columns={columns} selectionMode="multiple" showSelectionCheckboxes selectedKeys={selected} />
      <ActionBar isOpen={() => count() > 0} aria-label="Customer actions">
        <ActionBar.Prefix>
          <span id="action-bar-grid-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button variant="ghost" size="sm">
            <Icon icon={Mail} size={16} />
            <span class="action-bar__label">Email</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            id="action-bar-grid-archive"
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
          <Button variant="ghost" size="sm" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            <Icon icon={X} size={16} />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDataGrid />
    </div>
  );
}
