// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Async loading" };

interface Event {
  id: number;
  kind: string;
  at: string;
}

const page = (start: number): Event[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: start + i,
    kind: ["deploy", "alert", "login", "backup"][(start + i) % 4]!,
    at: `12:${String((start + i) % 60).padStart(2, "0")}`,
  }));

// #region demo
export function DataGridAsync() {
  const rows = signal<Event[]>(page(0));
  const loading = signal(false);
  const columns = [
    { id: "id", header: "#", accessorKey: "id" as const, width: 80 },
    { id: "kind", header: "Event", accessorKey: "kind" as const },
    { id: "at", header: "Time", accessorKey: "at" as const, align: "end" as const },
  ];
  return (
    <DataGrid<Event>
      aria-label="Event log"
      data={rows}
      columns={columns}
      height={320}
      isLoadingMore={loading}
      onLoadMore={() => {
        if (loading() || rows().length >= 100) return;
        loading.set(true);
        setTimeout(() => {
          rows.set([...rows(), ...page(rows().length)]);
          loading.set(false);
        }, 600);
      }}
      class="w-[480px]"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridAsync />
    </div>
  );
}
