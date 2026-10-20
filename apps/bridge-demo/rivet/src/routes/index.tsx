// Overview: KPI cards + recent orders in Rivet (no JS), the revenue chart as a React island hydrated when visible.
import "@rivetjs/bridge-react/types";
import type { PageProps } from "@rivetjs/router";
import { kpis, recent, revenue } from "../../../data.ts";
import { RevenueChart } from "../../../components/RevenueChart.react.tsx";
import { load } from "@rivetjs/router";

export const head = { title: "Overview" };

// Server-only (stands in for database queries): the chart island's `data` prop is serialized into the page, as in Next.
export const loader = load(() => ({ kpis, recent, revenue }));

export default function Overview({ data }: PageProps<typeof loader>) {
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
      <RevenueChart client={CLIENT ?? "visible"} data={data.revenue} />
      <section class="panel">
        <h2>Recent orders</h2>
        <table>
          <tbody>
            {data.recent.map((order) => (
              <tr>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>
                  <span class={"status " + order.status}>{order.status}</span>
                </td>
                <td>${order.total.toFixed(2)}</td>
                <td>{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
/** `BD_ALL_LOAD=1` (build env): the fairness control, every island `client="load"`. */
const CLIENT = import.meta.env.BD_ALL_LOAD === "1" ? ("load" as const) : undefined;
