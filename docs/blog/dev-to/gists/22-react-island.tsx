// src/routes/index.tsx: a Rivet file route. RevenueChart is an unmodified React component;
// the KPI cards around it are Rivet and ship no JavaScript.
import "@rivetjs/bridge-react/types";
import type { PageProps } from "@rivetjs/router";
import { kpis, revenue } from "../data.ts";
import { RevenueChart } from "../components/RevenueChart.react.tsx";

export const head = { title: "Overview" };

// Server-only (stands in for database queries): the chart island's `data` prop is serialized into the page.
export const serverLoad = () => ({ kpis, revenue });

export default function Overview({ data }: PageProps<typeof serverLoad>) {
  return (
    <main>
      <h1>Overview</h1>
      <section class="kpis">
        {data.kpis.map((kpi) => (
          <div class="kpi">
            <span>{kpi.label}</span>
            <b>{kpi.value}</b>
          </div>
        ))}
      </section>
      {/* Server-rendered by React into Rivet's stream; React hydrates it when it scrolls into view. */}
      <RevenueChart client="visible" data={data.revenue} />
    </main>
  );
}
