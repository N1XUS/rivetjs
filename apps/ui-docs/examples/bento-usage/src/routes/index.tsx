// Rivet-authored Bento demo (Rivet addition, no HeroUI counterpart): dashboard tiles built from Cards.
import { signal } from "@rivetjs/reactivity";
import { Bento } from "@rivetjs/ui/masonry";
import { Card } from "@rivetjs/ui/card";
import { Icon } from "@rivetjs/kit/icon";
import { Activity, CircleAlert, DollarSign, ShoppingCart, Timer, Users } from "lucide";

export const head = { title: "Bento: Usage" };

const tiles = [
  { id: "revenue", label: "Revenue", value: "$48.2k", note: "+8.1% this month", icon: DollarSign, colSpan: 2, rowSpan: 2 },
  { id: "users", label: "Active users", value: "3,214", note: "last 24 h", icon: Users },
  { id: "orders", label: "Orders", value: "912", note: "today", icon: ShoppingCart },
  { id: "traffic", label: "Traffic", value: "+12%", note: "vs last week", icon: Activity, colSpan: 2 },
  { id: "latency", label: "p95 latency", value: "184 ms", note: "API", icon: Timer, colSpan: 2 },
  { id: "errors", label: "Errors", value: "0.3%", note: "of requests", icon: CircleAlert, colSpan: 2 },
];

// #region demo
export function BentoUsage() {
  const opened = signal("none");
  return (
    <div class="flex w-[min(48rem,100%)] flex-col gap-3">
      <p class="text-sm text-muted">
        Opened: <span id="bento-usage-opened">{opened()}</span>
      </p>
      <Bento
        id="bento-usage"
        items={tiles}
        columns={{ 0: 2, 600: 4 }}
        rowHeight={120}
        gap={12}
        aria-label="Dashboard"
        onAction={(key) => opened.set(String(key))}
      >
        {(tile) => (
          <Card class="h-full justify-between">
            <span class="flex items-center gap-2 text-sm text-muted">
              <Icon icon={tile.icon} size={16} /> {tile.label}
            </span>
            <span class="flex flex-col">
              <span class="text-2xl font-semibold tabular-nums">{tile.value}</span>
              <span class="text-xs text-muted">{tile.note}</span>
            </span>
          </Card>
        )}
      </Bento>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <BentoUsage />
    </div>
  );
}
