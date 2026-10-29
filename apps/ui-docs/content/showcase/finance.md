---
title: Finance
description: "A personal finance overview: net worth over time, account balances, monthly income and spending, budgets, upcoming bills and a filterable transactions grid."
template: guide
status: experimental
related: [components/kpi, components/kpi-group, components/area-chart, components/bar-chart, components/data-grid, components/number-value, components/trend-chip, components/meter]
---

One household's money on one screen: invented accounts, three months of budgets and the transactions behind them.

::example{id=showcase-finance}

- Net worth sits in a [Card](/components/card/): a [NumberValue](/components/number-value/) sums the account balances, a [TrendChip](/components/trend-chip/) shows the change, and a range [Segment](/components/segment/) drives a keyed `Show` that re-creates the [AreaChart](/components/area-chart/) for 6 or 12 months. Charts carry no script; their tooltips are CSS.
- Accounts and upcoming bills are [ItemCardGroup](/components/item-card-group/) lists with a lucide icon per row and the balance or amount in the action slot; a negative card balance reads as a negative number, a manual bill carries a [Chip](/components/chip/) label (colour never alone).
- The month Segment re-creates everything that belongs to a month: a [KpiGroup](/components/kpi-group/) of income, spending (inverted: down is good), saved and savings rate, the cash flow [BarChart](/components/bar-chart/), a [DonutChart](/components/chart/) of the four largest categories plus the rest, and one [Meter](/components/meter/) per flexible budget (accent, then warning past 85 %, danger over budget, with the overspend in the value label).
- Transactions: a [DataGrid](/components/data-grid/) over a derived list (month, account Segment, [SearchField](/components/search-field/) on merchant or category), sortable by date and amount; amounts are signed NumberValues, money in also turns success green. An [EmptyState](/components/empty-state/) shows when nothing matches, and the [Widget](/components/widget/) footer counts the rows in a polite status line. Below 640 px the grid scrolls inside its card.
