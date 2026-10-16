---
title: Dashboard
description: "A store analytics dashboard: KPIs with sparklines, a revenue chart against the previous period, a channel donut and a filterable orders grid."
template: guide
status: experimental
related: [components/kpi, components/chart, components/data-grid, components/trend-chip]
---

The numbers behind the storefront: an invented month of revenue, orders and customers.

::example{id=showcase-dashboard}

- The period [Segment](/components/segment/) drives a keyed `Show`: KPIs and charts are computed once on the server for a period and re-created on the client when it changes. Charts carry no script at all; their tooltips are CSS.
- [Kpi](/components/kpi/) cards format values with `Intl.NumberFormat` and show the change with a [TrendChip](/components/trend-chip/); refund rate is inverted (down is good).
- [AreaChart](/components/chart/) compares this period with the previous one; the [DonutChart](/components/chart/) splits revenue by channel.
- Recent orders: a [DataGrid](/components/data-grid/) over a derived list, filtered by a status Segment and a [SearchField](/components/search-field/), sortable by order and total. Below 640 px the grid scrolls inside its card.
