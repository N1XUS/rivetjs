// Rivet-authored showcase (own content: an invented household's accounts, budgets and transactions).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { AreaChart, BarChart, DonutChart } from "@rivetjs/ui/chart";
import { Chip } from "@rivetjs/ui/chip";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";
import { NumberValue } from "@rivetjs/ui/number-value";
import { SearchField } from "@rivetjs/ui/search-field";
import { Segment } from "@rivetjs/ui/segment";
import { TrendChip } from "@rivetjs/ui/trend-chip";
import { Widget } from "@rivetjs/ui/widget";
import {
  ArrowLeftRight,
  Briefcase,
  ChartLine,
  CreditCard,
  Download,
  Dumbbell,
  HeartPulse,
  House,
  PiggyBank,
  Plane,
  ReceiptText,
  ShoppingCart,
  TrainFront,
  Tv,
  Utensils,
  Wallet,
  Zap,
} from "lucide";

export const head = { title: "Showcase: Finance" };

// #region demo
type Month = "aug" | "sep" | "oct";
type Range = "6m" | "1y";
type AccountKey = "checking" | "savings" | "credit" | "brokerage";
type Category = "housing" | "groceries" | "dining" | "transport" | "utilities" | "subscriptions" | "health" | "travel" | "income" | "transfer";
type Transaction = { id: string; month: Month; iso: string; date: string; merchant: string; category: Category; account: AccountKey; amount: number };

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd = (n: number) => usdFormat.format(n);
const usdShort = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`);

const ACCOUNTS = [
  { key: "checking", name: "Everyday checking", detail: "Ending 4821", balance: 8412.56, icon: Wallet },
  { key: "savings", name: "High-yield savings", detail: "4.10% APY", balance: 24180, icon: PiggyBank },
  { key: "brokerage", name: "Index portfolio", detail: "3 funds", balance: 41870.12, icon: ChartLine },
  { key: "credit", name: "Rewards card", detail: "Statement due Nov 12", balance: -1236.4, icon: CreditCard },
] as const;
const NET_WORTH = ACCOUNTS.reduce((sum, a) => sum + a.balance, 0);
const ACCOUNT_NAME: Record<AccountKey, string> = { checking: "Checking", savings: "Savings", brokerage: "Brokerage", credit: "Rewards card" };

const NET_WORTH_SERIES = {
  "6m": {
    change: 5316,
    percent: "7.8%",
    label: "in 6 months",
    points: [
      { x: "May 1", value: 67910 },
      { x: "May 15", value: 68240 },
      { x: "Jun 1", value: 68620 },
      { x: "Jun 15", value: 68510 },
      { x: "Jul 1", value: 69380 },
      { x: "Jul 15", value: 69820 },
      { x: "Aug 1", value: 70240 },
      { x: "Aug 15", value: 70610 },
      { x: "Sep 1", value: 71050 },
      { x: "Sep 15", value: 71480 },
      { x: "Oct 1", value: 71930 },
      { x: "Oct 15", value: 72640 },
      { x: "Oct 28", value: 73226 },
    ],
  },
  "1y": {
    change: 9106,
    percent: "14.2%",
    label: "in 12 months",
    points: [
      { x: "Nov", value: 64120 },
      { x: "Dec", value: 64910 },
      { x: "Jan", value: 65230 },
      { x: "Feb", value: 66840 },
      { x: "Mar", value: 66090 },
      { x: "Apr", value: 67910 },
      { x: "May", value: 68620 },
      { x: "Jun", value: 69380 },
      { x: "Jul", value: 70240 },
      { x: "Aug", value: 71050 },
      { x: "Sep", value: 71930 },
      { x: "Oct", value: 73226 },
    ],
  },
} as const;

const CASH_FLOW = [
  { month: "May", income: 6850, spending: 4220 },
  { month: "Jun", income: 6850, spending: 4510 },
  { month: "Jul", income: 6850, spending: 4390 },
  { month: "Aug", income: 7240, spending: 4612 },
  { month: "Sep", income: 6850, spending: 4105 },
  { month: "Oct", income: 7630, spending: 4182 },
];

const CATEGORY = {
  housing: { label: "Housing", icon: House, budget: 2150 },
  groceries: { label: "Groceries", icon: ShoppingCart, budget: 600 },
  dining: { label: "Dining out", icon: Utensils, budget: 350 },
  transport: { label: "Transport", icon: TrainFront, budget: 220 },
  utilities: { label: "Utilities", icon: Zap, budget: 260 },
  subscriptions: { label: "Subscriptions", icon: Tv, budget: 90 },
  health: { label: "Health", icon: HeartPulse, budget: 150 },
  travel: { label: "Travel", icon: Plane, budget: 400 },
  income: { label: "Income", icon: Briefcase, budget: 0 },
  transfer: { label: "Transfer", icon: ArrowLeftRight, budget: 0 },
} as const;
type SpendCategory = Exclude<Category, "income" | "transfer">;
// Flexible categories get a meter; rent is fixed and only shows in the donut.
const BUDGETED: SpendCategory[] = ["groceries", "dining", "travel", "utilities", "transport", "health"];

const MONTHS = {
  aug: {
    label: "August",
    income: 7240,
    incomeDelta: "5.7%",
    spending: 4612,
    spendingDelta: "5.1%",
    spendingTrend: "up",
    saved: 2628,
    savedDelta: "6.8%",
    rate: 0.363,
    rateDelta: "0.4 pt",
    spent: { housing: 2150, groceries: 612, dining: 389, transport: 213, utilities: 268, subscriptions: 87, health: 42, travel: 851 },
  },
  sep: {
    label: "September",
    income: 6850,
    incomeDelta: "5.4%",
    spending: 4105,
    spendingDelta: "11.0%",
    spendingTrend: "down",
    saved: 2745,
    savedDelta: "4.5%",
    rate: 0.401,
    rateDelta: "3.8 pt",
    spent: { housing: 2150, groceries: 571, dining: 298, transport: 204, utilities: 247, subscriptions: 87, health: 148, travel: 400 },
  },
  oct: {
    label: "October",
    income: 7630,
    incomeDelta: "11.4%",
    spending: 4182,
    spendingDelta: "1.9%",
    spendingTrend: "up",
    saved: 3448,
    savedDelta: "25.6%",
    rate: 0.452,
    rateDelta: "5.1 pt",
    spent: { housing: 2150, groceries: 548, dining: 412, transport: 186, utilities: 231, subscriptions: 87, health: 64, travel: 504 },
  },
} as const;
const INCOME_TREND = { aug: "up", sep: "down", oct: "up" } as const;

const TRANSACTIONS: Transaction[] = [
  {
    id: "t-oct-9",
    month: "oct",
    iso: "2026-10-28",
    date: "Oct 28",
    merchant: "Fresh Fields Market",
    category: "groceries",
    account: "checking",
    amount: -86.42,
  },
  { id: "t-oct-8", month: "oct", iso: "2026-10-27", date: "Oct 27", merchant: "Northline Transit", category: "transport", account: "credit", amount: -42 },
  {
    id: "t-oct-7",
    month: "oct",
    iso: "2026-10-25",
    date: "Oct 25",
    merchant: "Studio Kestrel invoice 0193",
    category: "income",
    account: "checking",
    amount: 780,
  },
  { id: "t-oct-6", month: "oct", iso: "2026-10-24", date: "Oct 24", merchant: "Osteria Lume", category: "dining", account: "credit", amount: -118.6 },
  {
    id: "t-oct-5",
    month: "oct",
    iso: "2026-10-22",
    date: "Oct 22",
    merchant: "Alpine Air, Lisbon return",
    category: "travel",
    account: "credit",
    amount: -504,
  },
  { id: "t-oct-4", month: "oct", iso: "2026-10-15", date: "Oct 15", merchant: "Halden Labs payroll", category: "income", account: "checking", amount: 3425 },
  { id: "t-oct-3", month: "oct", iso: "2026-10-14", date: "Oct 14", merchant: "Brightgrid Energy", category: "utilities", account: "checking", amount: -94.18 },
  { id: "t-oct-2", month: "oct", iso: "2026-10-02", date: "Oct 2", merchant: "Transfer from checking", category: "transfer", account: "savings", amount: 1500 },
  { id: "t-oct-1", month: "oct", iso: "2026-10-01", date: "Oct 1", merchant: "Maple Court Rentals", category: "housing", account: "checking", amount: -2150 },
  { id: "t-sep-8", month: "sep", iso: "2026-09-30", date: "Sep 30", merchant: "Halden Labs payroll", category: "income", account: "checking", amount: 3425 },
  {
    id: "t-sep-7",
    month: "sep",
    iso: "2026-09-29",
    date: "Sep 29",
    merchant: "Fresh Fields Market",
    category: "groceries",
    account: "checking",
    amount: -102.37,
  },
  { id: "t-sep-6", month: "sep", iso: "2026-09-26", date: "Sep 26", merchant: "Bao House", category: "dining", account: "credit", amount: -36.5 },
  { id: "t-sep-5", month: "sep", iso: "2026-09-18", date: "Sep 18", merchant: "Brightgrid Energy", category: "utilities", account: "checking", amount: -88.75 },
  { id: "t-sep-4", month: "sep", iso: "2026-09-15", date: "Sep 15", merchant: "Halden Labs payroll", category: "income", account: "checking", amount: 3425 },
  { id: "t-sep-3", month: "sep", iso: "2026-09-12", date: "Sep 12", merchant: "Pinecrest Pharmacy", category: "health", account: "credit", amount: -24.9 },
  { id: "t-sep-2", month: "sep", iso: "2026-09-02", date: "Sep 2", merchant: "Transfer from checking", category: "transfer", account: "savings", amount: 1500 },
  { id: "t-sep-1", month: "sep", iso: "2026-09-01", date: "Sep 1", merchant: "Maple Court Rentals", category: "housing", account: "checking", amount: -2150 },
  { id: "t-aug-8", month: "aug", iso: "2026-08-31", date: "Aug 31", merchant: "Halden Labs payroll", category: "income", account: "checking", amount: 3425 },
  { id: "t-aug-7", month: "aug", iso: "2026-08-28", date: "Aug 28", merchant: "Coastline Hotels, Porto", category: "travel", account: "credit", amount: -612 },
  {
    id: "t-aug-6",
    month: "aug",
    iso: "2026-08-24",
    date: "Aug 24",
    merchant: "Fresh Fields Market",
    category: "groceries",
    account: "checking",
    amount: -94.1,
  },
  {
    id: "t-aug-5",
    month: "aug",
    iso: "2026-08-19",
    date: "Aug 19",
    merchant: "Studio Kestrel invoice 0187",
    category: "income",
    account: "checking",
    amount: 390,
  },
  { id: "t-aug-4", month: "aug", iso: "2026-08-16", date: "Aug 16", merchant: "Osteria Lume", category: "dining", account: "credit", amount: -84.2 },
  { id: "t-aug-3", month: "aug", iso: "2026-08-15", date: "Aug 15", merchant: "Halden Labs payroll", category: "income", account: "checking", amount: 3425 },
  { id: "t-aug-2", month: "aug", iso: "2026-08-09", date: "Aug 9", merchant: "Ridgeline Fitness", category: "health", account: "credit", amount: -49 },
  { id: "t-aug-1", month: "aug", iso: "2026-08-01", date: "Aug 1", merchant: "Maple Court Rentals", category: "housing", account: "checking", amount: -2150 },
];

const BILLS = [
  { id: "rent", name: "Rent", due: "Nov 1", amount: 2150, autopay: true, icon: House },
  { id: "energy", name: "Brightgrid Energy", due: "Nov 4", amount: 91.4, autopay: true, icon: Zap },
  { id: "stream", name: "Streamly Family", due: "Nov 6", amount: 15.49, autopay: true, icon: Tv },
  { id: "gym", name: "Ridgeline Fitness", due: "Nov 9", amount: 49, autopay: false, icon: Dumbbell },
  { id: "card", name: "Card statement", due: "Nov 12", amount: 1236.4, autopay: false, icon: CreditCard },
] as const;

// Static lists live in their own components: the page's signals never reach them.
function Accounts() {
  return (
    <ItemCardGroup id="accounts" class="w-full" aria-labelledby="accounts-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="accounts-title">Accounts</ItemCardGroup.Title>
      </ItemCardGroup.Header>
      {ACCOUNTS.map((account) => (
        <ItemCard data-account={account.key}>
          <ItemCard.Icon>
            <Icon icon={account.icon} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>{account.name}</ItemCard.Title>
            <ItemCard.Description>{account.detail}</ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action>
            <NumberValue
              class={account.balance < 0 ? "font-medium text-danger tabular-nums" : "font-medium tabular-nums"}
              value={account.balance}
              style="currency"
              currency="USD"
            />
          </ItemCard.Action>
        </ItemCard>
      ))}
    </ItemCardGroup>
  );
}

function UpcomingBills() {
  return (
    <ItemCardGroup id="bills" class="w-full" aria-labelledby="bills-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="bills-title">Upcoming bills</ItemCardGroup.Title>
        <ItemCardGroup.Description>Next 14 days</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      {BILLS.map((bill) => (
        <ItemCard data-bill={bill.id}>
          <ItemCard.Icon>
            <Icon icon={bill.icon} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>{bill.name}</ItemCard.Title>
            <ItemCard.Description>Due {bill.due}</ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action class="flex items-center gap-3">
            {bill.autopay ? (
              <Chip size="sm" variant="soft">
                Autopay
              </Chip>
            ) : (
              <Chip size="sm" variant="soft" color="warning">
                Manual
              </Chip>
            )}
            <NumberValue class="font-medium tabular-nums" value={bill.amount} style="currency" currency="USD" />
          </ItemCard.Action>
        </ItemCard>
      ))}
    </ItemCardGroup>
  );
}

function CashFlow() {
  return (
    <Widget id="cash-flow" class="lg:col-span-2" role="region" aria-labelledby="cash-flow-title">
      <Widget.Header>
        <Widget.Title id="cash-flow-title">Cash flow</Widget.Title>
        <Widget.Description>Money in and out, last 6 months</Widget.Description>
      </Widget.Header>
      <Widget.Content>
        <BarChart
          data={CASH_FLOW}
          index="month"
          series={[
            { key: "income", label: "Income", color: "var(--chart-2)" },
            { key: "spending", label: "Spending", color: "var(--chart-5)" },
          ]}
          valueFormatter={usdShort}
          height={220}
          aria-label="Income against spending, May to October"
        />
      </Widget.Content>
    </Widget>
  );
}

function MonthView(props: { month: Month }) {
  const m = MONTHS[props.month];
  // Donut: the four largest categories, the rest folded into "Other".
  const ranked = (Object.keys(m.spent) as SpendCategory[])
    .map((key) => ({ key, label: CATEGORY[key].label, value: m.spent[key] }))
    .sort((a, b) => b.value - a.value);
  const donut = [...ranked.slice(0, 4), { key: "other", label: "Other", value: ranked.slice(4).reduce((sum, c) => sum + c.value, 0) }];
  return (
    <div class="flex flex-col gap-4">
      <KpiGroup id="month-kpis" class="w-full">
        <Kpi id="kpi-income">
          <Kpi.Title>Income</Kpi.Title>
          <Kpi.Body>
            <Kpi.Value value={m.income} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
            <Kpi.Trend trend={INCOME_TREND[props.month]}>{m.incomeDelta}</Kpi.Trend>
          </Kpi.Body>
        </Kpi>
        <KpiGroup.Separator />
        <Kpi id="kpi-spending">
          <Kpi.Title>Spending</Kpi.Title>
          <Kpi.Body>
            <Kpi.Value value={m.spending} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
            <Kpi.Trend trend={m.spendingTrend} isInverted>
              {m.spendingDelta}
            </Kpi.Trend>
          </Kpi.Body>
        </Kpi>
        <KpiGroup.Separator />
        <Kpi id="kpi-saved">
          <Kpi.Title>Saved</Kpi.Title>
          <Kpi.Body>
            <Kpi.Value value={m.saved} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
            <Kpi.Trend trend="up">{m.savedDelta}</Kpi.Trend>
          </Kpi.Body>
        </Kpi>
        <KpiGroup.Separator />
        <Kpi id="kpi-rate">
          <Kpi.Title>Savings rate</Kpi.Title>
          <Kpi.Body>
            <Kpi.Value value={m.rate} formatOptions={{ style: "percent", minimumFractionDigits: 1 }} />
            <Kpi.Trend trend="up">{m.rateDelta}</Kpi.Trend>
          </Kpi.Body>
        </Kpi>
      </KpiGroup>

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <CashFlow />
        <Widget id="categories" role="region" aria-labelledby="categories-title">
          <Widget.Header>
            <Widget.Title id="categories-title">Where it went</Widget.Title>
            <Widget.Description>{m.label} spending by category</Widget.Description>
          </Widget.Header>
          <Widget.Content class="flex justify-center">
            <DonutChart data={donut} size={150} valueFormatter={usd} centerLabel="Spent" aria-label={`Spending by category, ${m.label}`} />
          </Widget.Content>
        </Widget>
      </div>

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Widget id="budgets" role="region" aria-labelledby="budgets-title">
          <Widget.Header>
            <Widget.Title id="budgets-title">Budgets</Widget.Title>
            <Widget.Description>{m.label}, flexible categories</Widget.Description>
          </Widget.Header>
          <Widget.Content class="flex flex-col gap-4">
            {BUDGETED.map((key) => {
              const spent = m.spent[key];
              const budget = CATEGORY[key].budget;
              const ratio = spent / budget;
              const over = spent - budget;
              return (
                <Meter
                  data-budget={key}
                  value={Math.min(spent, budget)}
                  maxValue={budget}
                  valueLabel={over > 0 ? `${usd(spent)} of ${usd(budget)}, ${usd(over)} over` : `${usd(spent)} of ${usd(budget)}`}
                  color={ratio > 1 ? "danger" : ratio > 0.85 ? "warning" : "accent"}
                >
                  <Label class="flex items-center gap-2">
                    <Icon icon={CATEGORY[key].icon} size={16} />
                    {CATEGORY[key].label}
                  </Label>
                  <Meter.Output class="tabular-nums" />
                  <Meter.Track>
                    <Meter.Fill />
                  </Meter.Track>
                </Meter>
              );
            })}
          </Widget.Content>
        </Widget>
        <UpcomingBills />
      </div>
    </div>
  );
}

export function Finance() {
  const range = signal<string | null>("1y");
  const month = signal<string | null>("oct");
  const account = signal<string | null>("all");
  const query = signal("");
  const transactions = () => {
    const q = query().trim().toLowerCase();
    const m = month() ?? "oct";
    const a = account();
    return TRANSACTIONS.filter(
      (t) =>
        t.month === m &&
        (a === "all" || t.account === a) &&
        (!q || t.merchant.toLowerCase().includes(q) || CATEGORY[t.category].label.toLowerCase().includes(q)),
    );
  };
  const monthTotal = () => TRANSACTIONS.filter((t) => t.month === (month() ?? "oct")).length;
  const columns = [
    {
      id: "merchant",
      header: "Description",
      isRowHeader: true,
      width: "2fr" as const,
      cell: (t: Transaction) => (
        <div class="flex items-center gap-3">
          <span class="flex size-9 flex-none items-center justify-center rounded-full bg-default text-muted">
            <Icon icon={CATEGORY[t.category].icon} size={16} />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="font-medium">{t.merchant}</span>
            <span class="truncate text-xs text-muted">{CATEGORY[t.category].label}</span>
          </div>
        </div>
      ),
    },
    { id: "account", header: "Account", cell: (t: Transaction) => <span class="text-muted">{ACCOUNT_NAME[t.account]}</span> },
    { id: "iso", header: "Date", accessorKey: "iso" as const, allowsSorting: true, cell: (t: Transaction) => <span class="tabular-nums">{t.date}</span> },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount" as const,
      allowsSorting: true,
      align: "end" as const,
      cell: (t: Transaction) => (
        <NumberValue
          class={t.amount > 0 ? "font-medium text-success tabular-nums" : "font-medium tabular-nums"}
          value={t.amount}
          style="currency"
          currency="USD"
          signDisplay="exceptZero"
        />
      ),
    },
  ];

  return (
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header class="flex flex-wrap items-center gap-3">
        <div class="me-auto">
          <h1 class="text-xl font-semibold">Money</h1>
          <p class="text-sm text-muted">Maya Chen · 4 accounts · synced today at 9:41</p>
        </div>
        <Button size="sm" variant="secondary">
          <Icon icon={Download} size={16} />
          Statements
        </Button>
      </header>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card id="net-worth" class="lg:col-span-2">
          <Card.Header class="flex flex-row flex-wrap items-start gap-3">
            <div class="me-auto flex flex-col gap-1">
              <Card.Description>Net worth</Card.Description>
              <NumberValue
                id="net-worth-value"
                class="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
                value={NET_WORTH}
                style="currency"
                currency="USD"
              />
            </div>
            <Segment id="range" aria-label="Range" selectedKey={range} size="sm">
              <Segment.Item id="6m">6 months</Segment.Item>
              <Segment.Item id="1y">12 months</Segment.Item>
            </Segment>
          </Card.Header>
          {/* The chart reads its data once: a keyed Show re-creates it per range. */}
          <Show keyed when={(range() ?? "1y") as Range}>
            {(key) => {
              const r = NET_WORTH_SERIES[key()];
              return (
                <Card.Content class="flex flex-col gap-3">
                  <div id="net-worth-trend" class="flex flex-wrap items-center gap-2 text-sm">
                    <TrendChip trend="up">{r.percent}</TrendChip>
                    <span class="text-muted">
                      <NumberValue value={r.change} style="currency" currency="USD" maximumFractionDigits={0} signDisplay="always" /> {r.label}
                    </span>
                  </div>
                  <AreaChart
                    data={[...r.points]}
                    index="x"
                    series={[{ key: "value", label: "Net worth" }]}
                    valueFormatter={usdShort}
                    minValue={60000}
                    showLegend={false}
                    height={200}
                    aria-label={`Net worth ${r.label}`}
                  />
                </Card.Content>
              );
            }}
          </Show>
        </Card>
        <Accounts />
      </div>

      <section class="flex flex-col gap-4" aria-labelledby="month-title">
        <div class="flex flex-wrap items-center gap-3">
          <h2 id="month-title" class="me-auto text-lg font-semibold">
            Monthly overview
          </h2>
          <Segment id="month" aria-label="Month" selectedKey={month} size="sm">
            <Segment.Item id="aug">Aug</Segment.Item>
            <Segment.Item id="sep">Sep</Segment.Item>
            <Segment.Item id="oct">Oct</Segment.Item>
          </Segment>
        </div>
        {/* KPIs, charts and budgets read their month once: a keyed Show re-creates them per month. */}
        <Show keyed when={(month() ?? "oct") as Month}>
          {(key) => <MonthView month={key()} />}
        </Show>
      </section>

      <Widget id="transactions" role="region" aria-labelledby="transactions-title">
        <Widget.Header>
          <Widget.Title id="transactions-title" class="me-auto">
            Transactions
          </Widget.Title>
          <div class="max-w-full overflow-x-auto">
            <Segment id="tx-account" aria-label="Account" selectedKey={account} size="sm">
              <Segment.Item id="all">All</Segment.Item>
              <Segment.Item id="checking">Checking</Segment.Item>
              <Segment.Item id="credit">Card</Segment.Item>
              <Segment.Item id="savings">Savings</Segment.Item>
            </Segment>
          </div>
          <SearchField id="tx-search" aria-label="Search transactions" value={query} class="w-full sm:w-56">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Merchant or category" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </Widget.Header>
        <Widget.Content class="overflow-x-auto p-0">
          <DataGrid<Transaction>
            id="tx-grid"
            aria-label="Transactions"
            data={transactions}
            columns={columns}
            class="min-w-[40rem]"
            renderEmptyState={() => (
              <EmptyState class="flex flex-col items-center gap-2 py-6">
                <Icon icon={ReceiptText} size={24} />
                <p>No transactions match.</p>
              </EmptyState>
            )}
          />
        </Widget.Content>
        <Widget.Footer id="tx-count" role="status">
          {`${transactions().length} of ${monthTotal()} transactions in ${MONTHS[(month() ?? "oct") as Month].label}`}
        </Widget.Footer>
      </Widget>
    </div>
  );
}
// #endregion

export default function Demo() {
  return <Finance />;
}
