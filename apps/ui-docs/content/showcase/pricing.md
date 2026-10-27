---
title: Pricing
description: "A pricing page with monthly / yearly billing, a seat stepper that updates every total, a comparison table and an FAQ accordion."
template: guide
status: experimental
related: [components/card, components/segment, components/number-stepper, components/accordion, components/chip, components/table, components/feature-list, components/number-value]
---

An invented shop builder's plans. Choosing a plan only shows what would be bought.

::example{id=showcase-pricing}

- A [Segment](/components/segment/) switches the billing period and a [NumberStepper](/components/number-stepper/) sets the team size. Prices and totals are accessors over both signals, so each text node updates in place: no card is re-created.
- Plans are [Cards](/components/card/) from one data list; the highlighted plan gets a ring and a [Chip](/components/chip/). Prices are [NumberValues](/components/number-value/) (euro, tabular figures); features are a [FeatureList](/components/feature-list/). Each button reports the chosen plan, period, seats and total in an [Alert](/components/alert/) inside a polite status region.
- The comparison is a [Table](/components/table/) with row and column headers in its scroll container, so it scrolls sideways on narrow screens while the page itself never does. Included / not included are lucide icons with an `aria-label`.
- The questions are an [Accordion](/components/accordion/).
