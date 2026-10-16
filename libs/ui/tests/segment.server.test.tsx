// Server-target suite: `Segment` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// SSR — radiogroup + radio items (aria-checked), BEM classes + data-slot per part, size / variant modifiers, default selection
// (`defaultSelectedKey`, two-way `selectedKey` signal), indicator only in the selected item, separators, disabled item / group.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Segment } from "../src/components/segment/index.ts";

test("segment SSR: radiogroup, classes, default selection, indicator in the selected item", async () => {
  const html = await renderToString(() => (
    <Segment aria-label="View" defaultSelectedKey="week" id="seg">
      <Segment.Item id="day">Day</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="week">Week</Segment.Item>
      <Segment.Item id="month">Month</Segment.Item>
    </Segment>
  ));
  const root = /<div[^>]*id="seg"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(root, /role="radiogroup"/);
  assert.match(root, /class="segment segment--md segment--default"/);
  assert.match(root, /data-slot="segment"/);
  assert.match(root, /aria-label="View"/);
  const radios = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(radios.length, 3);
  for (const b of radios) {
    assert.match(b, /role="radio"/);
    assert.match(b, /class="segment__item"/);
    assert.match(b, /data-slot="segment-item"/);
  }
  assert.match(radios[1]!, /aria-checked="true"/);
  assert.match(radios[0]!, /aria-checked="false"/);
  assert.equal((html.match(/data-slot="segment-indicator"/g) ?? []).length, 1);
  assert.match(html, /aria-checked="true"[^>]*>(?:<!--[^>]*-->)*<div[^>]*class="segment__indicator"/);
  assert.match(html, /<span class="segment__label" data-slot="segment-label">Week<\/span>/);
  assert.match(html, /<span aria-hidden="true" class="segment__separator" data-slot="segment-separator"/);
});

test("segment SSR: size / variant modifiers, selectedKey signal, disabled item + group", async () => {
  const key = signal<string | null>("b");
  const html = await renderToString(() => (
    <>
      <Segment aria-label="A" size="sm" variant="ghost" selectedKey={key} id="s1">
        <Segment.Item id="a">A</Segment.Item>
        <Segment.Item id="b">B</Segment.Item>
        <Segment.Item id="c" isDisabled>
          C
        </Segment.Item>
      </Segment>
      <Segment aria-label="B" size="lg" isDisabled id="s2">
        <Segment.Item id="x">X</Segment.Item>
      </Segment>
    </>
  ));
  assert.match(/<div[^>]*id="s1"[^>]*>/.exec(html)?.[0] ?? "", /class="segment segment--sm segment--ghost"/);
  const s1 = html.slice(html.indexOf('id="s1"'), html.indexOf('id="s2"'));
  const items = s1.match(/<button[^>]*>/g) ?? [];
  assert.match(items[1]!, /aria-checked="true"/);
  assert.match(items[2]!, /disabled/);
  const s2 = /<div[^>]*id="s2"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(s2, /class="segment segment--lg segment--default"/);
  assert.match(s2, /aria-disabled="true"/);
  assert.match(s2, /data-disabled="true"/);
});

test("segment SSR: function children get the render props", async () => {
  const html = await renderToString(() => (
    <Segment aria-label="Icons" defaultSelectedKey="grid">
      <Segment.Item id="list">{({ isSelected }) => (isSelected() ? "List on" : "List")}</Segment.Item>
      <Segment.Item id="grid">{({ isSelected }) => (isSelected() ? "Grid on" : "Grid")}</Segment.Item>
    </Segment>
  ));
  assert.match(html, />List</);
  assert.match(html, />Grid on</);
});
