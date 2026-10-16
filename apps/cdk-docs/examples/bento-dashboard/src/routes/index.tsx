import { signal } from "@rivetjs/reactivity";
import { Bento } from "@rivetjs/cdk/masonry";
import { Activity, CircleAlert, DollarSign, ShoppingCart, Timer, Users } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Bento: dashboard tiles" };

const tiles = [
  { id: "revenue", label: "Revenue", value: "$48.2k", icon: DollarSign, colSpan: { 0: 2, 640: 2 }, rowSpan: 2 },
  { id: "users", label: "Active users", value: "3,214", icon: Users },
  { id: "orders", label: "Orders", value: "912", icon: ShoppingCart },
  { id: "traffic", label: "Traffic", value: "+12%", icon: Activity, colSpan: 2 },
  { id: "latency", label: "p95 latency", value: "184 ms", icon: Timer, colSpan: 2 },
  { id: "errors", label: "Errors", value: "0.3%", icon: CircleAlert, colSpan: 2 },
];

// #region demo
export default function BentoDashboard() {
  const opened = signal("none");
  return (
    <div class="m-4">
      <p class="m-0 mb-2 text-sm text-slate-600">
        Opened: <span id="opened">{opened()}</span>
      </p>
      <Bento
        id="dashboard"
        items={tiles}
        columns={{ 0: 2, 640: 4 }}
        rowHeight={110}
        gap={10}
        aria-label="Dashboard"
        onAction={(key) => opened.set(String(key))}
        itemClass="rounded-2xl bg-slate-50 ring-1 ring-slate-200 outline-none cursor-pointer data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500"
      >
        {(tile) => (
          <div class="flex h-full flex-col justify-between p-4">
            <span class="flex items-center gap-2 text-sm text-slate-500">
              <Icon icon={tile.icon} size={16} /> {tile.label}
            </span>
            <span class="text-2xl font-semibold tabular-nums">{tile.value}</span>
          </div>
        )}
      </Bento>
    </div>
  );
}
// #endregion
