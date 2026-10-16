// Server-target suite: `Accordion` SSR (upstream accordion.ssr.test.tsx: `defaultExpandedKeys` renders `data-slot="accordion"`
// + `data-expanded="true"`). Rivet: one expanded trigger, collapsed panel `hidden`, BEM classes, hideSeparator / surface.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Accordion } from "../index.ts";

const Fixture = (props: { hideSeparator?: boolean; variant?: "default" | "surface" }) => (
  <Accordion data-testid="accordion" defaultExpandedKeys={["faq-1"]} hideSeparator={props.hideSeparator} variant={props.variant}>
    <Accordion.Item id="faq-1">
      <Accordion.Heading>
        <Accordion.Trigger>
          How do I place an order?
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>Browse our products and proceed to checkout.</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item id="faq-2">
      <Accordion.Heading>
        <Accordion.Trigger>
          Can I modify my order?
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>Yes, before it ships.</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);

test("accordion SSR: one expanded item (upstream)", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="accordion"/);
  assert.match(html, /data-expanded="true"/);
  assert.equal(html.match(/aria-expanded="true"/g)!.length, 1);
  assert.equal(html.match(/aria-expanded="false"/g)!.length, 1);
  const panels = html.match(/<div[^>]*data-slot="accordion-panel"[^>]*>/g)!;
  assert.equal(panels.length, 2);
  assert.doesNotMatch(panels[0]!, /\shidden/);
  assert.match(panels[1]!, /\shidden/);
  for (const c of ["accordion__item", "accordion__heading", "accordion__trigger", "accordion__panel", "accordion__body", "accordion__indicator"])
    assert.match(html, new RegExp(c));
  assert.doesNotMatch(html, /data-hide-separator/);
});

test("accordion SSR: hideSeparator + surface variant", async () => {
  const html = await renderToString(() => <Fixture hideSeparator variant="surface" />);
  assert.equal(html.match(/data-hide-separator="true"/g)!.length, 2);
  assert.match(html, /accordion--surface/);
});
