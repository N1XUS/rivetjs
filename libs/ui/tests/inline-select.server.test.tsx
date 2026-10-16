// Server-target suite: `InlineSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) SSR — inline root + ghost trigger classes, value text, up / down default indicator, hidden select; inside
// `Breadcrumbs.Item` (function child): no link around the trigger, the item separator kept, the current item has none.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { assertSameHtml } from "./same-html.ts";
import { Breadcrumbs } from "../src/components/breadcrumbs/index.ts";
import { ListBox } from "../src/components/list-box/index.ts";
import { InlineSelect } from "../src/components/inline-select/index.ts";

const Team = () => (
  <InlineSelect defaultValue="acme" aria-label="Team" name="team">
    <InlineSelect.Trigger>
      <InlineSelect.Value />
      <InlineSelect.Indicator />
    </InlineSelect.Trigger>
    <InlineSelect.Popover>
      <ListBox>
        <ListBox.Item id="acme" textValue="Acme">
          Acme
        </ListBox.Item>
        <ListBox.Item id="globex" textValue="Globex">
          Globex
        </ListBox.Item>
      </ListBox>
    </InlineSelect.Popover>
  </InlineSelect>
);

test("inline-select SSR: root, trigger, value, indicator, hidden select", async () => {
  const html = await renderToString(() => <Team />);
  assert.match(html, /data-slot="inline-select"[^>]*class="inline-select"|class="inline-select"[^>]*data-slot="inline-select"/);
  assert.match(html, /<button[^>]*class="inline-select__trigger"/);
  assert.match(html, /class="inline-select__value"[^>]*>(?:<!--[^>]*-->)*Acme/);
  assert.match(html, /data-slot="inline-select-default-indicator"/);
  assert.match(html, /<select[^>]*name="team"/);
});

test("inline-select SSR: auto form (items) = compound form", async () => {
  const teams = [
    { id: "acme", name: "Acme" },
    { id: "globex", name: "Globex" },
  ];
  const Auto = () => (
    <InlineSelect defaultValue="acme" aria-label="Team" name="team" items={teams}>
      {(t: { id: string; name: string }) => (
        <ListBox.Item id={t.id} textValue={t.name}>
          {t.name}
        </ListBox.Item>
      )}
    </InlineSelect>
  );
  await assertSameHtml(
    () => <Auto />,
    () => <Team />,
  );
});

test("inline-select SSR: Breadcrumbs.Item function child keeps the separator, no link around the trigger", async () => {
  const html = await renderToString(() => (
    <Breadcrumbs>
      <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item>
        {({ separator }) => (
          <>
            <Team />
            {separator()}
          </>
        )}
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Settings</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  const items = html.split(/<li /).slice(1);
  assert.equal(items.length, 3);
  assert.match(items[1]!, /inline-select__trigger/);
  assert.doesNotMatch(items[1]!, /<a /);
  assert.match(items[1]!, /data-slot="breadcrumbs-separator"/);
  assert.doesNotMatch(items[2]!, /data-slot="breadcrumbs-separator"/);
});
