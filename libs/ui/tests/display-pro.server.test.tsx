// Server-target suite (Rivet additions, feature sets inspired by HeroUI Pro's public docs, independent implementations):
// KpiGroup (group role, orientation, cards inside, decorative separator), NumberValue (Intl formatting from the convenience
// props + formatOptions override + locale, prefix / suffix shorthand, compound parts, render function), Widget (parts,
// legend dot colour, render), ItemCard (variants, parts, render as a link), ItemCardGroup (list / grid layout, columns,
// header), Timeline (ol / li, default rail + marker + connector, aria-current, decorative empty markers, axis / placement /
// size / density classes, item side / align, connector force).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Kpi } from "../src/components/kpi/index.ts";
import { KpiGroup } from "../src/components/kpi-group/index.ts";
import { NumberValue, formatNumberValue } from "../src/components/number-value/index.ts";
import { Widget } from "../src/components/widget/index.ts";
import { ItemCard } from "../src/components/item-card/index.ts";
import { ItemCardGroup } from "../src/components/item-card-group/index.ts";
import { Timeline } from "../src/components/timeline/index.ts";

test("kpi group SSR: group, orientation, separator", async () => {
  const html = await renderToString(() => (
    <KpiGroup orientation="vertical" class="w-80">
      <Kpi>
        <Kpi.Title>A</Kpi.Title>
      </Kpi>
      <KpiGroup.Separator />
      <Kpi>
        <Kpi.Title>B</Kpi.Title>
      </Kpi>
    </KpiGroup>
  ));
  assert.match(html, /<div role="group" class="kpi-group kpi-group--vertical w-80" data-slot="kpi-group" data-orientation="vertical">/);
  assert.match(html, /<span aria-hidden="true" class="kpi-group__separator" data-slot="kpi-group-separator"><\/span>/);
  assert.equal((html.match(/class="kpi kpi--default"/g) ?? []).length, 2);
  const h = await renderToString(() => <KpiGroup />);
  assert.match(h, /kpi-group kpi-group--horizontal/);
  assert.match(h, /data-orientation="horizontal"/);
});

test("number value: formatting options", () => {
  assert.equal(formatNumberValue({ value: 1234.5, style: "currency", currency: "USD" }, "en-US"), "$1,234.50");
  assert.equal(formatNumberValue({ value: 1520000, notation: "compact" }, "en-US"), "1.5M");
  assert.equal(formatNumberValue({ value: 0.256, style: "percent", maximumFractionDigits: 1 }, "en-US"), "25.6%");
  assert.equal(formatNumberValue({ value: 12, signDisplay: "always" }, "en-US"), "+12");
  assert.equal(formatNumberValue({ value: 21, style: "unit", unit: "celsius" }, "en-US"), "21°C");
  // formatOptions win over the convenience props; locale override
  assert.equal(formatNumberValue({ value: 3.14159, maximumFractionDigits: 1, formatOptions: { maximumFractionDigits: 3 } }, "en-US"), "3.142");
  assert.equal(formatNumberValue({ value: 1234.5, locale: "de-DE" }, "en-US"), "1.234,5");
  assert.equal(formatNumberValue({ value: () => 7 }, "en-US"), "7");
});

test("number value SSR: shorthand, compound parts, render function", async () => {
  const plain = await renderToString(() => <NumberValue value={48210} style="currency" currency="USD" maximumFractionDigits={0} isTabular />);
  assert.match(
    plain,
    /<span class="number-value number-value--tabular" data-slot="number-value"><span class="number-value__value" data-slot="number-value-value">\$48,210<\/span><\/span>/,
  );
  const affixed = await renderToString(() => <NumberValue value={12} prefix="~" suffix="/mo" />);
  assert.match(
    affixed,
    /number-value__prefix" data-slot="number-value-prefix">~<\/span><span class="number-value__value" data-slot="number-value-value">12<\/span><span class="number-value__suffix" data-slot="number-value-suffix">\/mo</,
  );
  const parts = await renderToString(() => (
    <NumberValue value={0.42} style="percent" aria-label="Conversion">
      <NumberValue.Prefix>up</NumberValue.Prefix>
      <NumberValue.Value />
    </NumberValue>
  ));
  assert.match(parts, /aria-label="Conversion"/);
  assert.match(parts, />up<\/span><span class="number-value__value" data-slot="number-value-value">42%</);
  const fn = await renderToString(() => <NumberValue value={5}>{(formatted) => <b>{formatted} pts</b>}</NumberValue>);
  assert.match(fn, /<b>5 pts<\/b>/);
});

test("widget SSR: parts + legend colour", async () => {
  const html = await renderToString(() => (
    <Widget class="max-w-md">
      <Widget.Header>
        <Widget.Title>Revenue</Widget.Title>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-2)">Web</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>chart</Widget.Content>
      <Widget.Footer>Updated today</Widget.Footer>
    </Widget>
  ));
  assert.match(html, /<div class="widget max-w-md" data-slot="widget">/);
  assert.match(html, /<span class="widget__title" data-slot="widget-title">Revenue<\/span>/);
  assert.match(html, /class="widget__legend-item" data-slot="widget-legend-item" style="--widget-legend-color:var\(--chart-2\)"/);
  assert.match(html, /<span aria-hidden="true" class="widget__legend-item-dot"/);
  assert.match(html, /class="widget__content" data-slot="widget-content">chart</);
  assert.match(html, /class="widget__footer"/);
  const section = await renderToString(() => <Widget render={(p) => <section {...p} />}>x</Widget>);
  assert.match(section, /<section class="widget" data-slot="widget">x<\/section>/);
});

test("item card SSR: variants, parts, render as a link", async () => {
  const html = await renderToString(() => (
    <ItemCard variant="outline">
      <ItemCard.Icon>i</ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title>Wi-Fi</ItemCard.Title>
        <ItemCard.Description>Home network</ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action>on</ItemCard.Action>
    </ItemCard>
  ));
  assert.match(html, /<div class="item-card item-card--outline" data-slot="item-card">/);
  for (const part of ["icon", "content", "action"]) assert.match(html, new RegExp(`<div class="item-card__${part}" data-slot="item-card-${part}">`));
  assert.match(html, /<span class="item-card__title" data-slot="item-card-title">Wi-Fi<\/span>/);
  assert.match(html, /<span class="item-card__description" data-slot="item-card-description">Home network<\/span>/);
  const link = await renderToString(() => (
    <ItemCard render={(p) => <a href="/settings" {...p} />}>
      <ItemCard.Content>Settings</ItemCard.Content>
    </ItemCard>
  ));
  assert.match(link, /<a href="\/settings" class="item-card item-card--default" data-slot="item-card">/);
});

test("item card group SSR: list + grid", async () => {
  const list = await renderToString(() => (
    <ItemCardGroup variant="secondary" aria-labelledby="g-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="g-title">Devices</ItemCardGroup.Title>
        <ItemCardGroup.Description>Signed in</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>a</ItemCard>
    </ItemCardGroup>
  ));
  assert.match(
    list,
    /<div role="group" class="item-card-group item-card-group--list item-card-group--secondary" data-slot="item-card-group" data-layout="list" aria-labelledby="g-title">/,
  );
  assert.match(list, /<h3 class="item-card-group__title" data-slot="item-card-group-title" id="g-title">Devices<\/h3>/);
  assert.match(list, /<p class="item-card-group__description"/);
  const grid = await renderToString(() => <ItemCardGroup layout="grid" columns={3} variant="transparent" />);
  assert.match(grid, /class="item-card-group item-card-group--grid item-card-group--transparent"/);
  assert.match(grid, /data-layout="grid" style="--item-card-group-columns:3"/);
});

test("timeline SSR: ol / li, default rail, status, centered axis", async () => {
  const html = await renderToString(() => (
    <Timeline axis="center" placement="alternate" size="sm" density="compact" aria-label="Releases">
      <Timeline.Item status="success">
        <Timeline.Content>v1</Timeline.Content>
      </Timeline.Item>
      <Timeline.Item status="current" side="start" align="center">
        <Timeline.Rail>
          <Timeline.Marker>2</Timeline.Marker>
          <Timeline.Connector force />
        </Timeline.Rail>
        <Timeline.Content side="end">v2</Timeline.Content>
      </Timeline.Item>
    </Timeline>
  ));
  assert.match(
    html,
    /<ol class="timeline timeline--center timeline--compact timeline--placement-alternate timeline--sm" data-slot="timeline" data-axis="center" data-item-align="start" aria-label="Releases">/,
  );
  assert.match(html, /<li class="timeline__item" data-slot="timeline-item" data-status="success">/);
  assert.match(html, /<li class="timeline__item" data-slot="timeline-item" data-status="current" data-align="center" data-side="start" aria-current="true">/);
  // default rail (hidden by CSS when the item has its own rail): decorative marker dot + connector
  assert.equal((html.match(/class="timeline__rail timeline__rail--default"/g) ?? []).length, 2);
  assert.match(
    html,
    /<span aria-hidden="true" class="timeline__rail timeline__rail--default" data-slot="timeline-rail"><span class="timeline__marker timeline__marker--dot" data-slot="timeline-marker"><\/span><span class="timeline__connector" data-slot="timeline-connector"><\/span><\/span>/,
  );
  // own rail: its default marker + the custom marker (content, not hidden) + forced connector
  assert.match(html, /<span class="timeline__marker" data-slot="timeline-marker">2<\/span>/);
  assert.match(html, /class="timeline__connector" data-slot="timeline-connector" data-force=""/);
  assert.match(html, /<div class="timeline__content" data-slot="timeline-content" data-side="end">v2<\/div>/);
  const empty = await renderToString(() => (
    <Timeline>
      <Timeline.Item>
        <Timeline.Rail>
          <Timeline.Marker status="warning" />
        </Timeline.Rail>
      </Timeline.Item>
    </Timeline>
  ));
  assert.match(empty, /timeline timeline--start timeline--comfortable timeline--placement-end timeline--md/);
  assert.match(empty, /<span class="timeline__marker timeline__marker--dot" data-slot="timeline-marker" data-status="warning" aria-hidden="true"><\/span>/);
});
