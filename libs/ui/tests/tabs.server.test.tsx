// Server-target suite: `Tabs` SSR (upstream tabs.ssr.test.tsx: controlled `selectedKey` + `Tabs.Indicator` renders without
// mismatch). Rivet: the selected tab + its panel only, one indicator, ListContainer chrome (scroller + scroll buttons + lucide
// chevrons), BEM classes, variant / align modifiers, vertical labels, Separator.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Tabs } from "../index.ts";

const Fixture = (props: { orientation?: "horizontal" | "vertical"; variant?: "primary" | "secondary"; align?: "start" | "center" | "end" }) => (
  <Tabs data-testid="tabs" selectedKey="analytics" orientation={props.orientation} variant={props.variant} align={props.align}>
    <Tabs.ListContainer>
      <Tabs.List aria-label="Options">
        <Tabs.Tab id="overview">
          Overview
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab id="analytics">
          <Tabs.Separator />
          Analytics
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab isDisabled id="reports">
          Reports
          <Tabs.Indicator />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
    <Tabs.Panel id="overview">Overview panel</Tabs.Panel>
    <Tabs.Panel id="analytics">Analytics panel</Tabs.Panel>
    <Tabs.Panel id="reports">Reports panel</Tabs.Panel>
  </Tabs>
);

test("tabs SSR: controlled selectedKey + Tabs.Indicator (upstream)", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="tabs"/);
  assert.match(html, /data-testid="tabs"/);
  assert.equal(html.match(/role="tab"/g)!.length, 3);
  assert.equal(html.match(/aria-selected="true"/g)!.length, 1);
  assert.match(html, /<div[^>]*aria-selected="true"[^>]*>(?:(?!<\/div>).)*Analytics/s);
  assert.equal(html.match(/data-slot="tabs-indicator"/g)!.length, 1);
  assert.equal(html.match(/role="tabpanel"/g)!.length, 1);
  assert.match(html, /Analytics panel/);
  assert.doesNotMatch(html, /Overview panel|Reports panel/);
  assert.match(html, /aria-disabled="true"/);
  for (const c of ["tabs__list-container", "tabs__list-container__scroller", "tabs__list", "tabs__tab", "tabs__indicator", "tabs__panel", "tabs__separator"])
    assert.match(html, new RegExp(`class="[^"]*\\b${c}\\b`), c);
  assert.match(html, /aria-label="Scroll tabs left"/);
  assert.match(html, /aria-label="Scroll tabs right"/);
  assert.equal(html.match(/<svg/g)!.length, 2);
  assert.match(html, /data-slot="tabs-separator"[^>]*|aria-hidden="true"[^>]*data-slot="tabs-separator"/);
  assert.doesNotMatch(html, /tabs--secondary|tabs--align-/);
});

test("tabs SSR: vertical + secondary + align end", async () => {
  const html = await renderToString(() => <Fixture orientation="vertical" variant="secondary" align="end" />);
  assert.match(html, /tabs--secondary/);
  assert.match(html, /tabs--align-end/);
  assert.match(html, /data-orientation="vertical"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(html, /aria-label="Scroll tabs up"/);
  assert.match(html, /aria-label="Scroll tabs down"/);
});

test("tabs SSR: default selection sees the tabs inside a ListContainer (cdk build pass)", async () => {
  const html = await renderToString(() => (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab isDisabled id="a">
            A
          </Tabs.Tab>
          <Tabs.Tab id="b">
            B
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="a">Panel A</Tabs.Panel>
      <Tabs.Panel id="b">Panel B</Tabs.Panel>
    </Tabs>
  ));
  assert.match(html, /<div[^>]*data-key="b"[^>]*aria-selected="true"/);
  assert.match(html, /Panel B/);
  assert.doesNotMatch(html, /Panel A/);
  assert.equal(html.match(/data-slot="tabs-indicator"/g)!.length, 1);
});

test("tabs SSR: List without ListContainer + automatic indicators = the explicit parts' markup", async () => {
  const mask = (h: string) => h.replace(/ (id|aria-controls|aria-labelledby|data-collection)="[^"]*"/g, "");
  const explicit = await renderToString(() => (
    <Tabs defaultSelectedKey="b">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab id="a">
            A
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="b">
            B
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="a">{() => "a"}</Tabs.Panel>
      <Tabs.Panel id="b">b</Tabs.Panel>
    </Tabs>
  ));
  const folded = await renderToString(() => (
    <Tabs defaultSelectedKey="b">
      <Tabs.List aria-label="Options">
        <Tabs.Tab id="a">A</Tabs.Tab>
        <Tabs.Tab id="b">B</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">{() => "a"}</Tabs.Panel>
      <Tabs.Panel id="b">b</Tabs.Panel>
    </Tabs>
  ));
  assert.equal((explicit.match(/data-slot="tabs-indicator"/g) ?? []).length, 1);
  assert.equal(mask(folded), mask(explicit));
});
