import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";
import { ComposedChart } from "@rivetjs/ui/composed-chart";
import { PieChart } from "@rivetjs/ui/pie-chart";
import { RadarChart } from "@rivetjs/ui/radar-chart";
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "Charts (Pro)" };

const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 24 },
  { label: "Firefox", value: 9 },
  { label: "Other", value: 5 },
];

const SKILLS = [
  { skill: "Speed", a: 82, b: 55 },
  { skill: "Power", a: 64, b: 88 },
  { skill: "Range", a: 45, b: 72 },
  { skill: "Agility", a: 90, b: 60 },
  { skill: "Stamina", a: 70, b: 80 },
];

const SALES = [
  { m: "Jan", online: 40, retail: 24, target: 70 },
  { m: "Feb", online: 52, retail: 28, target: 72 },
  { m: "Mar", online: 47, retail: 31, target: 75 },
  { m: "Apr", online: 61, retail: 30, target: 80 },
  { m: "May", online: 66, retail: 35, target: 84 },
];

// UI-PORT S6 (Rivet additions, feature sets inspired by HeroUI Pro's public chart docs): pie with a custom ChartTooltip,
// donut, radar, radial progress, a shrink-to-fit grid of fixed-size polar plots (`#polar-grid`) and a composed chart. Markup + CSS only: nothing boots.
export default function ChartsProStory() {
  return (
    <main class="flex max-w-3xl flex-col gap-10 bg-background p-6 text-foreground">
      <PieChart
        id="pie"
        data={BROWSERS}
        labels="percent"
        tooltip={(point) => (
          <ChartTooltip.Content label={point.label} payload={point.items.map((i) => ({ name: i.name, value: `${i.formatted}%`, color: i.color }))} />
        )}
      />
      <PieChart id="donut" data={BROWSERS} innerRadius={0.62} paddingAngle={2} centerLabel="Visitors" legend="breakdown" />
      <RadarChart
        id="radar"
        data={SKILLS}
        index="skill"
        series={[
          { key: "a", label: "Alpha" },
          { key: "b", label: "Beta", dots: true },
        ]}
      />
      <RadialChart id="radial" data={[{ label: "Done", value: 72 }]} innerRadius={0.62} outerRadius={0.9} centerLabel="complete">
        72%
      </RadialChart>
      {/* Fixed-size plots in a shrink-to-fit grid (UI-BUGS 2026-10-27: the docs gauge grid stacked its three gauges). */}
      <div class="flex justify-center">
        <div id="polar-grid" class="grid grid-cols-3 gap-6">
          <RadialChart data={[{ label: "CPU", value: 68 }]} size={120} startAngle={210} endAngle={-30} innerRadius={0.68} outerRadius={0.92} centerLabel="CPU">
            68%
          </RadialChart>
          <PieChart data={BROWSERS} size={120} />
          <RadarChart data={SKILLS} index="skill" size={120} series={[{ key: "a", label: "Alpha" }]} />
        </div>
      </div>
      <ComposedChart
        id="composed"
        data={SALES}
        index="m"
        stacked
        series={[
          { key: "online", label: "Online", type: "bar" },
          { key: "retail", label: "Retail", type: "bar" },
          { key: "target", label: "Target", type: "line", dashed: true },
        ]}
      />
    </main>
  );
}
