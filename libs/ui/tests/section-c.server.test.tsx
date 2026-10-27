// Server-target suite (UI-PORT S7, Rivet additions with feature sets inspired by HeroUI Pro's public docs, independent
// implementations): TrendChip parts / sizes / variants, EmptyState structured parts + outline, Rating custom icons and
// render function, Kpi content / progress / actions / separator / icon status.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Icon } from "@rivetjs/kit/icon";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Heart, Inbox, Star, TrendingUp } from "lucide";
import { EmptyState } from "../src/components/empty-state/index.ts";
import { Kpi } from "../src/components/kpi/index.ts";
import { Rating } from "../src/components/rating/index.ts";
import { TrendChip } from "../src/components/trend-chip/index.ts";

test("trend chip: prefix / suffix / custom indicator, lg, primary", async () => {
  const html = await renderToString(() => (
    <TrendChip trend="up" size="lg" variant="primary">
      <TrendChip.Prefix>+</TrendChip.Prefix>
      <TrendChip.Indicator>
        <Icon icon={TrendingUp} size={16} />
      </TrendChip.Indicator>
      12%
      <TrendChip.Suffix>vs last week</TrendChip.Suffix>
    </TrendChip>
  ));
  assert.match(html, /class="trend-chip trend-chip--lg trend-chip--positive trend-chip--primary"/);
  assert.match(html, /<span class="trend-chip__prefix" data-slot="trend-chip-prefix">\+<\/span>/);
  assert.match(html, /class="trend-chip__indicator" data-slot="trend-chip-indicator" aria-hidden="true"><svg/);
  assert.match(html, /<span class="trend-chip__suffix" data-slot="trend-chip-suffix">vs last week<\/span>/);
  // the default icon stays in the markup (CSS hides it next to a custom indicator)
  assert.match(html, /class="trend-chip__icon"/);
});

test("trend chip: secondary / tertiary variants", async () => {
  const html = await renderToString(() => (
    <div>
      <TrendChip trend="down" variant="secondary">
        3%
      </TrendChip>
      <TrendChip variant="tertiary">0%</TrendChip>
    </div>
  ));
  assert.match(html, /trend-chip--negative trend-chip--secondary/);
  assert.match(html, /trend-chip--neutral trend-chip--tertiary/);
});

test("empty state: structured parts, media variant, outline; plain text keeps the default", async () => {
  const html = await renderToString(() => (
    <EmptyState variant="outline" size="lg">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Icon icon={Inbox} size={24} />
        </EmptyState.Media>
        <EmptyState.Title>No messages</EmptyState.Title>
        <EmptyState.Description>New mail shows up here.</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <button type="button">Refresh</button>
      </EmptyState.Content>
    </EmptyState>
  ));
  assert.match(html, /class="empty-state empty-state--lg empty-state--outline"/);
  assert.match(html, /class="empty-state__media" data-slot="empty-state-media" data-variant="icon"><svg/);
  assert.match(html, /<h3 class="empty-state__title" data-slot="empty-state-title">No messages<\/h3>/);
  assert.match(html, /<p class="empty-state__description" data-slot="empty-state-description">New mail shows up here.<\/p>/);
  assert.match(html, /class="empty-state__content" data-slot="empty-state-content"><button/);
  assert.match(await renderToString(() => <EmptyState />), />No results found</);
});

// Icon markers: each lucide icon's first path, as rendered.
const mark = (icon: typeof Heart): RegExp => new RegExp(`d="${String(icon[0][1].d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g");

test("rating: one icon for all, one per value, render function", async () => {
  const hearts = await renderToString(() => <Rating isReadOnly value={2} icon={Heart} />);
  assert.equal((hearts.match(mark(Heart)) ?? []).length, 10);
  const mixed = await renderToString(() => <Rating isReadOnly value={3} maxValue={2} icon={(n) => (n === 1 ? Heart : Star)} />);
  assert.equal((mixed.match(mark(Heart)) ?? []).length, 2);
  assert.equal((mixed.match(mark(Star)) ?? []).length, 2);
  const custom = await renderToString(() => (
    <Rating
      isReadOnly
      value={2.5}
      maxValue={3}
      renderItem={(item) => (
        <b data-active={item.isActive ? "" : undefined} data-partial={item.isPartial ? "" : undefined}>
          {item.partialPercent}
        </b>
      )}
    />
  ));
  assert.match(custom, /<b data-active="">100<\/b>.*<b data-active="">100<\/b>.*<b data-partial="">50<\/b>/s);
  assert.doesNotMatch(custom, mark(Star));
  const interactive = await renderToString(() => <Rating defaultValue={2} maxValue={3} renderItem={(item) => <i>{item.isActive ? "on" : "off"}</i>} />);
  assert.match(interactive, /<i>on<\/i>.*<i>on<\/i>.*<i>off<\/i>/s);
});

test("kpi: content, progress, actions, separator, icon status", async () => {
  const html = await renderToString(() => (
    <Kpi>
      <Kpi.Header>
        <Kpi.Icon status="warning">S</Kpi.Icon>
        <Kpi.Title>Storage</Kpi.Title>
      </Kpi.Header>
      <Kpi.Actions>
        <button type="button">More</button>
      </Kpi.Actions>
      <Kpi.Content>
        <Kpi.Value value={72} />
        <Kpi.Trend trend="up">4%</Kpi.Trend>
      </Kpi.Content>
      <Kpi.Progress value={120} status="danger" aria-label="Storage used" />
      <Kpi.Separator />
      <Kpi.Footer>2 GB left</Kpi.Footer>
    </Kpi>
  ));
  assert.match(html, /class="kpi__icon" data-slot="kpi-icon" data-status="warning"/);
  assert.match(html, /class="kpi__actions" data-slot="kpi-actions"/);
  assert.match(html, /class="kpi__content" data-slot="kpi-content"/);
  assert.match(html, /data-status="danger" role="progressbar" aria-label="Storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"/);
  assert.match(html, /--kpi-progress:100%/);
  assert.match(html, /<hr class="kpi__separator" data-slot="kpi-separator"/);
});
