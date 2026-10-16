// Rivet-authored showcase (own content: an invented shop's numbers, customers and orders).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { AreaChart, DonutChart, Sparkline } from "@rivetjs/ui/chart";
import { Chip } from "@rivetjs/ui/chip";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { Kpi } from "@rivetjs/ui/kpi";
import { SearchField } from "@rivetjs/ui/search-field";
import { Segment } from "@rivetjs/ui/segment";
import { ChartNoAxesCombined, Download, Percent, ReceiptText, RotateCcw, Wallet } from "lucide";

export const head = { title: "Showcase: Dashboard" };

// #region demo
type Period = "7d" | "30d" | "90d";
type Order = { id: number; customer: string; email: string; items: number; total: number; status: "paid" | "shipped" | "refunded" | "pending"; date: string };

const PERIODS = {
  "7d": {
    label: "last 7 days",
    revenue: 11940,
    revenueDelta: "6.1%",
    orders: 214,
    ordersDelta: "3.4%",
    conversion: 0.031,
    conversionDelta: "0.2 pt",
    refunds: 0.014,
    refundsDelta: "0.3 pt",
    refundsTrend: "up",
    series: [
      { x: "Mon", revenue: 1520, previous: 1410 },
      { x: "Tue", revenue: 1690, previous: 1530 },
      { x: "Wed", revenue: 1610, previous: 1660 },
      { x: "Thu", revenue: 1840, previous: 1590 },
      { x: "Fri", revenue: 2010, previous: 1880 },
      { x: "Sat", revenue: 1780, previous: 1710 },
      { x: "Sun", revenue: 1490, previous: 1470 },
    ],
    channels: [
      { key: "search", label: "Search", value: 4710 },
      { key: "direct", label: "Direct", value: 3380 },
      { key: "email", label: "Newsletter", value: 2260 },
      { key: "social", label: "Social", value: 1590 },
    ],
  },
  "30d": {
    label: "last 30 days",
    revenue: 48210,
    revenueDelta: "9.6%",
    orders: 873,
    ordersDelta: "7.2%",
    conversion: 0.033,
    conversionDelta: "0.4 pt",
    refunds: 0.011,
    refundsDelta: "0.2 pt",
    refundsTrend: "down",
    series: [
      { x: "Sep 9", revenue: 1320, previous: 1210 },
      { x: "Sep 12", revenue: 1480, previous: 1290 },
      { x: "Sep 15", revenue: 1410, previous: 1380 },
      { x: "Sep 18", revenue: 1590, previous: 1350 },
      { x: "Sep 21", revenue: 1720, previous: 1460 },
      { x: "Sep 24", revenue: 1650, previous: 1520 },
      { x: "Sep 27", revenue: 1810, previous: 1490 },
      { x: "Sep 30", revenue: 1760, previous: 1610 },
      { x: "Oct 3", revenue: 1930, previous: 1580 },
      { x: "Oct 6", revenue: 2040, previous: 1700 },
    ],
    channels: [
      { key: "search", label: "Search", value: 18920 },
      { key: "direct", label: "Direct", value: 13110 },
      { key: "email", label: "Newsletter", value: 9640 },
      { key: "social", label: "Social", value: 6540 },
    ],
  },
  "90d": {
    label: "last 90 days",
    revenue: 131560,
    revenueDelta: "14.8%",
    orders: 2398,
    ordersDelta: "11.0%",
    conversion: 0.032,
    conversionDelta: "0.0 pt",
    refunds: 0.012,
    refundsDelta: "0.1 pt",
    refundsTrend: "down",
    series: [
      { x: "W28", revenue: 9100, previous: 8300 },
      { x: "W29", revenue: 9420, previous: 8510 },
      { x: "W30", revenue: 9800, previous: 8870 },
      { x: "W31", revenue: 9650, previous: 9020 },
      { x: "W32", revenue: 10210, previous: 8940 },
      { x: "W33", revenue: 10480, previous: 9310 },
      { x: "W34", revenue: 10020, previous: 9450 },
      { x: "W35", revenue: 10870, previous: 9380 },
      { x: "W36", revenue: 11240, previous: 9720 },
      { x: "W37", revenue: 11030, previous: 9910 },
      { x: "W38", revenue: 11720, previous: 10040 },
      { x: "W39", revenue: 12020, previous: 10260 },
    ],
    channels: [
      { key: "search", label: "Search", value: 51210 },
      { key: "direct", label: "Direct", value: 36400 },
      { key: "email", label: "Newsletter", value: 25110 },
      { key: "social", label: "Social", value: 18840 },
    ],
  },
} as const;

const ORDERS: Order[] = [
  { id: 1048, customer: "Ada Okafor", email: "ada.okafor@example.com", items: 3, total: 214, status: "paid", date: "Oct 8" },
  { id: 1047, customer: "Lukas Brenner", email: "lukas.b@example.com", items: 1, total: 128, status: "pending", date: "Oct 8" },
  { id: 1046, customer: "Mei Tanaka", email: "mei.tanaka@example.com", items: 2, total: 92, status: "shipped", date: "Oct 7" },
  { id: 1045, customer: "Rowan Ellis", email: "rowan.ellis@example.com", items: 4, total: 301, status: "shipped", date: "Oct 7" },
  { id: 1044, customer: "Sofia Marquez", email: "sofia.m@example.com", items: 1, total: 42, status: "refunded", date: "Oct 6" },
  { id: 1043, customer: "Jonah Adeyemi", email: "jonah.a@example.com", items: 2, total: 156, status: "paid", date: "Oct 6" },
  { id: 1042, customer: "Hanna Lund", email: "hanna.lund@example.com", items: 5, total: 388, status: "shipped", date: "Oct 5" },
  { id: 1041, customer: "Priya Natarajan", email: "priya.n@example.com", items: 1, total: 68, status: "paid", date: "Oct 5" },
];
const STATUS_COLOR = { paid: "success", shipped: "accent", refunded: "danger", pending: "warning" } as const;

// One module-level formatter: `toLocaleString(locale, options)` builds a new Intl.NumberFormat on every call.
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd = (n: number) => usdFormat.format(n);

export function Dashboard() {
  const period = signal<string | null>("30d");
  const query = signal("");
  const status = signal<string | null>("all");
  const orders = () => {
    const q = query().trim().toLowerCase();
    const s = status();
    return ORDERS.filter((o) => (s === "all" || o.status === s) && (!q || o.customer.toLowerCase().includes(q) || String(o.id).includes(q)));
  };
  const columns = [
    { id: "id", header: "Order", accessorKey: "id" as const, allowsSorting: true, cell: (o: Order) => <span class="font-medium tabular-nums">#{o.id}</span> },
    {
      id: "customer",
      header: "Customer",
      isRowHeader: true,
      cell: (o: Order) => (
        <div class="flex items-center gap-2.5">
          <Avatar size="sm">
            <Avatar.Fallback>
              {o.customer
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </Avatar.Fallback>
          </Avatar>
          <div class="flex min-w-0 flex-col">
            <span class="truncate font-medium">{o.customer}</span>
            <span class="truncate text-xs text-muted">{o.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (o: Order) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[o.status]}>
          {o.status}
        </Chip>
      ),
    },
    { id: "date", header: "Date", accessorKey: "date" as const },
    {
      id: "total",
      header: "Total",
      accessorKey: "total" as const,
      allowsSorting: true,
      align: "end" as const,
      cell: (o: Order) => <span class="tabular-nums">{usd(o.total)}</span>,
    },
  ];

  return (
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header class="flex flex-wrap items-center gap-3">
        <div class="me-auto">
          <h1 class="text-xl font-semibold">Overview</h1>
          <p class="text-sm text-muted">Fieldnote Supply · all channels</p>
        </div>
        <Segment id="period" aria-label="Period" selectedKey={period} size="sm">
          <Segment.Item id="7d">7 days</Segment.Item>
          <Segment.Item id="30d">30 days</Segment.Item>
          <Segment.Item id="90d">90 days</Segment.Item>
        </Segment>
        <Button size="sm" variant="secondary">
          <Icon icon={Download} size={16} />
          Export
        </Button>
      </header>

      {/* Charts read their data once: a keyed Show re-creates this block per period. */}
      <Show keyed when={(period() ?? "30d") as Period}>
        {(key) => {
          const p = PERIODS[key()];
          const spark = (field: "revenue" | "previous") => p.series.map((point) => ({ x: point.x, v: point[field] }));
          return (
            <div class="flex flex-col gap-5">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi id="kpi-revenue">
                  <Kpi.Header>
                    <Kpi.Title>Revenue</Kpi.Title>
                    <Kpi.Icon>
                      <Icon icon={Wallet} size={16} />
                    </Kpi.Icon>
                  </Kpi.Header>
                  <Kpi.Body>
                    <Kpi.Value value={p.revenue} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
                    <Kpi.Trend trend="up">{p.revenueDelta}</Kpi.Trend>
                  </Kpi.Body>
                  <Kpi.Chart>
                    <Sparkline data={spark("revenue")} index="x" series={[{ key: "v", label: "Revenue" }]} height={40} aria-label="Revenue trend" />
                  </Kpi.Chart>
                </Kpi>
                <Kpi>
                  <Kpi.Header>
                    <Kpi.Title>Orders</Kpi.Title>
                    <Kpi.Icon>
                      <Icon icon={ReceiptText} size={16} />
                    </Kpi.Icon>
                  </Kpi.Header>
                  <Kpi.Body>
                    <Kpi.Value value={p.orders} />
                    <Kpi.Trend trend="up">{p.ordersDelta}</Kpi.Trend>
                  </Kpi.Body>
                  <Kpi.Description>vs. the period before</Kpi.Description>
                </Kpi>
                <Kpi>
                  <Kpi.Header>
                    <Kpi.Title>Conversion</Kpi.Title>
                    <Kpi.Icon>
                      <Icon icon={Percent} size={16} />
                    </Kpi.Icon>
                  </Kpi.Header>
                  <Kpi.Body>
                    <Kpi.Value value={p.conversion} formatOptions={{ style: "percent", minimumFractionDigits: 1 }} />
                    <Kpi.Trend trend={p.conversionDelta === "0.0 pt" ? "neutral" : "up"}>{p.conversionDelta}</Kpi.Trend>
                  </Kpi.Body>
                  <Kpi.Description>Sessions that ordered</Kpi.Description>
                </Kpi>
                <Kpi>
                  <Kpi.Header>
                    <Kpi.Title>Refund rate</Kpi.Title>
                    <Kpi.Icon>
                      <Icon icon={RotateCcw} size={16} />
                    </Kpi.Icon>
                  </Kpi.Header>
                  <Kpi.Body>
                    <Kpi.Value value={p.refunds} formatOptions={{ style: "percent", minimumFractionDigits: 1 }} />
                    <Kpi.Trend trend={p.refundsTrend} isInverted>
                      {p.refundsDelta}
                    </Kpi.Trend>
                  </Kpi.Body>
                  <Kpi.Description>Lower is better</Kpi.Description>
                </Kpi>
              </div>
              <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <section class="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-surface lg:col-span-2">
                  <div class="flex items-center gap-2">
                    <Icon icon={ChartNoAxesCombined} size={16} class="text-muted" />
                    <h2 class="text-sm font-medium">Revenue, {p.label}</h2>
                  </div>
                  <AreaChart
                    data={[...p.series]}
                    index="x"
                    series={[
                      { key: "revenue", label: "This period" },
                      { key: "previous", label: "Previous period", color: "var(--chart-3)" },
                    ]}
                    valueFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v}`)}
                    height={220}
                    aria-label={`Revenue, ${p.label}, against the previous period`}
                  />
                </section>
                <section class="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-surface">
                  <h2 class="text-sm font-medium">Revenue by channel</h2>
                  <DonutChart data={[...p.channels]} size={150} valueFormatter={usd} centerLabel="Revenue" aria-label={`Revenue by channel, ${p.label}`} />
                </section>
              </div>
            </div>
          );
        }}
      </Show>

      <section class="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-surface">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="me-auto text-sm font-medium">Recent orders</h2>
          <div class="max-w-full overflow-x-auto">
            <Segment aria-label="Status" selectedKey={status} size="sm">
              <Segment.Item id="all">All</Segment.Item>
              <Segment.Item id="paid">Paid</Segment.Item>
              <Segment.Item id="shipped">Shipped</Segment.Item>
              <Segment.Item id="pending">Pending</Segment.Item>
              <Segment.Item id="refunded">Refunded</Segment.Item>
            </Segment>
          </div>
          <SearchField id="order-search" aria-label="Search orders" value={query} class="w-full sm:w-56">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Customer or order" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        <div class="-mx-4 overflow-x-auto px-4">
          <DataGrid<Order> id="orders" aria-label="Recent orders" data={orders} columns={columns} class="min-w-[40rem]" />
        </div>
        <p class="text-xs text-muted">{orders().length === 0 ? "No orders match." : `${orders().length} of ${ORDERS.length} orders`}</p>
      </section>
    </div>
  );
}
// #endregion

export default function Demo() {
  return <Dashboard />;
}
