// Rivet-authored Kpi demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Kpi } from "@rivetjs/ui/kpi";

export const head = { title: "Kpi: with progress" };

// #region demo
const GOALS = [
  { title: "Quarterly target", value: 82, status: "success" },
  { title: "Storage used", value: 91, status: "danger" },
] as const;

export function WithProgress() {
  return (
    <div id="kpi-progress" class="grid w-full max-w-xl gap-3 sm:grid-cols-2">
      {GOALS.map((goal) => (
        <Kpi>
          <Kpi.Header>
            <Kpi.Title>{goal.title}</Kpi.Title>
          </Kpi.Header>
          <Kpi.Value value={goal.value / 100} formatOptions={{ style: "percent" }} />
          <Kpi.Progress value={goal.value} status={goal.status} aria-label={goal.title} />
        </Kpi>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithProgress />
    </div>
  );
}
