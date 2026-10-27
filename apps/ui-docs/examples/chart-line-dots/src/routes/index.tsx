// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Line with dots" };

// #region demo
const SIGNUPS = [
  { week: "W1", signups: 120 },
  { week: "W2", signups: 168 },
  { week: "W3", signups: 151 },
  { week: "W4", signups: 205 },
  { week: "W5", signups: 189 },
  { week: "W6", signups: 242 },
  { week: "W7", signups: 260 },
];

export function LineDots() {
  return (
    <LineChart
      id="chart-line-dots"
      class="w-full max-w-2xl"
      data={SIGNUPS}
      index="week"
      showDots
      series={[{ key: "signups", label: "Sign-ups" }]}
      aria-label="Weekly sign-ups"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <LineDots />
    </div>
  );
}
