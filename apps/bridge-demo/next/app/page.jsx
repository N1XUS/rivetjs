// Overview: KPI cards + recent orders as server components, the revenue chart as a client component.
import { kpis, recent, revenue } from "../../data.ts";
import { RevenueChart } from "./_client/revenue-chart.jsx";

export default function Overview() {
  return (
    <main>
      <h1>Overview</h1>
      <section className="kpis">
        {kpis.map((kpi) => (
          <div className="kpi" key={kpi.label}>
            <span>{kpi.label}</span>
            <b>{kpi.value}</b>
          </div>
        ))}
      </section>
      <RevenueChart data={revenue} />
      <section className="panel">
        <h2>Recent orders</h2>
        <table>
          <tbody>
            {recent.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>
                  <span className={"status " + order.status}>{order.status}</span>
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
