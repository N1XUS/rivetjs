// Rivet-authored LineChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "LineChart: Missing Values" };

// #region demo
// `null` (or a missing key) = no reading that day.
const READINGS = [
  { day: "Mon", indoor: 21.4, outdoor: 12.1 },
  { day: "Tue", indoor: 21.9, outdoor: null },
  { day: "Wed", indoor: null, outdoor: 14.8 },
  { day: "Thu", indoor: 22.3, outdoor: 15.2 },
  { day: "Fri", indoor: 22.0, outdoor: 13.4 },
  { day: "Sat", indoor: 21.1 },
  { day: "Sun", indoor: 20.8, outdoor: 11.9 },
];

export function LineGaps() {
  return (
    <div class="flex w-full max-w-2xl flex-col gap-8">
      <LineChart
        id="line-chart-gaps"
        data={READINGS}
        index="day"
        showDots
        series={[
          { key: "indoor", label: "Indoor" },
          { key: "outdoor", label: "Outdoor" },
        ]}
        valueFormatter={(v) => `${v} °C`}
        aria-label="Temperature with missing readings"
        height={200}
      />
      <LineChart
        id="line-chart-gaps-joined"
        data={READINGS}
        index="day"
        connectNulls
        series={[
          { key: "indoor", label: "Indoor" },
          { key: "outdoor", label: "Outdoor" },
        ]}
        valueFormatter={(v) => `${v} °C`}
        aria-label="Temperature, joined across missing readings"
        height={200}
      />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <LineGaps />
    </div>
  );
}
