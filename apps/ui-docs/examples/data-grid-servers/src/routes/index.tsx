// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { signal } from "@rivetjs/reactivity";
import { Chip } from "@rivetjs/ui/chip";
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Servers" };

interface Server {
  id: string;
  host: string;
  region: string;
  cpu: number;
  state: "healthy" | "degraded" | "down";
}

const SERVERS: Server[] = [
  { id: "a1", host: "api-01", region: "eu-north", cpu: 34, state: "healthy" },
  { id: "a2", host: "api-02", region: "eu-north", cpu: 81, state: "degraded" },
  { id: "w1", host: "worker-01", region: "us-east", cpu: 12, state: "healthy" },
  { id: "w2", host: "worker-02", region: "us-east", cpu: 0, state: "down" },
  { id: "db", host: "db-primary", region: "eu-west", cpu: 57, state: "healthy" },
];
const STATE_COLOR = { healthy: "success", degraded: "warning", down: "danger" } as const;

// #region demo
export function DataGridServers() {
  const opened = signal("");
  const columns = [
    { id: "host", header: "Host", accessorKey: "host" as const, allowsSorting: true },
    { id: "region", header: "Region", accessorKey: "region" as const, allowsSorting: true },
    {
      id: "cpu",
      header: "CPU",
      allowsSorting: true,
      accessorKey: "cpu" as const,
      cell: (s: Server) => (
        <div class="flex items-center gap-2">
          <div class="h-1.5 w-20 overflow-hidden rounded-full bg-default">
            <div class={s.cpu > 75 ? "h-full bg-warning" : "h-full bg-accent"} style={{ width: `${s.cpu}%` }} />
          </div>
          <span class="tabular-nums">{s.cpu}%</span>
        </div>
      ),
    },
    {
      id: "state",
      header: "State",
      cell: (s: Server) => (
        <Chip size="sm" variant="soft" color={STATE_COLOR[s.state]}>
          {s.state}
        </Chip>
      ),
    },
  ];
  return (
    <div class="flex w-[600px] flex-col gap-3">
      <DataGrid<Server> aria-label="Servers" variant="secondary" data={SERVERS} columns={columns} onRowAction={(key) => opened.set(String(key))} />
      <p id="data-grid-servers-opened" class="text-sm text-muted">
        {opened() ? `Opened ${opened()}` : "Press a row to open it"}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridServers />
    </div>
  );
}
