// Rivet-authored TrendChip demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "TrendChip: tabular numbers" };

// #region demo
const ROWS = [
  { name: "Signups", change: "11.1%", trend: "up" },
  { name: "Activation", change: "4.8%", trend: "up" },
  { name: "Churn", change: "0.7%", trend: "down" },
] as const;

export function TabularNums() {
  return (
    <ul id="tc-tabular" class="flex w-56 flex-col gap-2">
      {ROWS.map((row) => (
        <li class="flex items-center justify-between text-sm">
          {row.name}
          <TrendChip trend={row.trend} isInverted={row.name === "Churn"}>
            {row.change}
          </TrendChip>
        </li>
      ))}
    </ul>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <TabularNums />
    </div>
  );
}
