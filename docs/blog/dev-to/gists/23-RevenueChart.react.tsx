/** @jsxImportSource react */
// Revenue chart (recharts): paid vs refunded per month, tooltip + legend. Fixed size (no ResponsiveContainer: it
// measures in the browser and renders nothing on the server).
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart(props: { data: { month: string; paid: number; refunded: number }[] }) {
  return (
    <figure className="chart" id="revenue-chart">
      <BarChart width={640} height={260} data={props.data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" />
        <YAxis width={56} />
        <Tooltip />
        <Legend />
        <Bar dataKey="paid" name="Paid" fill="#0360fa" isAnimationActive={false} />
        <Bar dataKey="refunded" name="Refunded" fill="#b815f9" isAnimationActive={false} />
      </BarChart>
      <figcaption>Revenue by month (USD)</figcaption>
    </figure>
  );
}
