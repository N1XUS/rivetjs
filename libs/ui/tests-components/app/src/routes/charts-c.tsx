import { BarChart, LineChart } from "@rivetjs/ui/chart";

export const head = { title: "Charts (gaps, dots, horizontal)" };

const UPTIME = [
  { day: "Mon", api: 99.2, web: 98.1 },
  { day: "Tue", api: 99.5, web: null },
  { day: "Wed", api: null, web: 98.9 },
  { day: "Thu", api: 99.1, web: 99.3 },
  { day: "Fri", api: 99.7, web: 99.0 },
];

const BROWSERS = [
  { browser: "Chrome", desktop: 420, mobile: 310 },
  { browser: "Safari", desktop: 180, mobile: 260 },
  { browser: "Firefox", desktop: 120, mobile: 40 },
];

// UI-PORT-C (Rivet additions, feature sets inspired by HeroUI Pro's public area / bar / line chart docs): a line chart
// with gaps and dots, the same data joined across the gaps with a dashed series, and grouped / stacked horizontal bars.
// Markup + CSS only: nothing boots.
export default function ChartsCStory() {
  return (
    <main class="flex max-w-3xl flex-col gap-10 bg-background p-6 text-foreground">
      <LineChart
        id="gaps"
        data={UPTIME}
        index="day"
        showDots
        minValue={97}
        maxValue={100}
        series={[
          { key: "api", label: "API" },
          { key: "web", label: "Web" },
        ]}
        aria-label="Uptime with missing days"
      />
      <LineChart
        id="joined"
        data={UPTIME}
        index="day"
        connectNulls
        minValue={97}
        maxValue={100}
        series={[
          { key: "api", label: "API", color: "var(--chart-3)" },
          { key: "web", label: "Web", color: "var(--chart-5)", dashed: true },
        ]}
        aria-label="Uptime, joined across missing days"
      />
      <BarChart
        id="hbar"
        data={BROWSERS}
        index="browser"
        orientation="horizontal"
        series={[
          { key: "desktop", label: "Desktop" },
          { key: "mobile", label: "Mobile" },
        ]}
        aria-label="Visits by browser"
      />
      <BarChart
        id="hstack"
        data={BROWSERS}
        index="browser"
        orientation="horizontal"
        stacked
        series={[
          { key: "desktop", label: "Desktop" },
          { key: "mobile", label: "Mobile" },
        ]}
        aria-label="Visits by browser, stacked"
      />
    </main>
  );
}
