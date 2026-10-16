// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { Icon } from "@rivetjs/kit/icon";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Inbox } from "lucide";

export const head = { title: "DataGrid: Empty state" };

interface Invoice {
  id: string;
  customer: string;
  amount: number;
}

// #region demo
export function DataGridEmpty() {
  const columns = [
    { id: "id", header: "Invoice", accessorKey: "id" as const },
    { id: "customer", header: "Customer", accessorKey: "customer" as const },
    { id: "amount", header: "Amount", accessorKey: "amount" as const, align: "end" as const },
  ];
  return (
    <DataGrid<Invoice>
      aria-label="Invoices"
      data={[]}
      columns={columns}
      class="w-[520px]"
      renderEmptyState={() => (
        <EmptyState>
          <span class="flex flex-col items-center gap-2">
            <Icon icon={Inbox} class="size-6" aria-hidden="true" />
            No invoices yet
          </span>
        </EmptyState>
      )}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridEmpty />
    </div>
  );
}
