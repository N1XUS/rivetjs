// Server-target suite: `Disclosure` SSR (upstream disclosure.ssr.test.tsx: defaultExpanded renders `data-slot="disclosure"` +
// `aria-expanded="true"`). Rivet: collapsed panel `hidden`, part classes + data-slots, `data-expanded` on the root / content /
// indicator from the server state, lucide chevron indicator.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Disclosure } from "../index.ts";

const Fixture = (props: { defaultExpanded?: boolean }) => (
  <Disclosure defaultExpanded={props.defaultExpanded} data-testid="disclosure">
    <Disclosure.Heading>
      <Disclosure.Trigger>
        Toggle content
        <Disclosure.Indicator />
      </Disclosure.Trigger>
    </Disclosure.Heading>
    <Disclosure.Content>
      <Disclosure.Body>Hidden content revealed on expand.</Disclosure.Body>
    </Disclosure.Content>
  </Disclosure>
);

test("disclosure SSR: defaultExpanded (upstream)", async () => {
  const html = await renderToString(() => <Fixture defaultExpanded />);
  assert.match(html, /data-slot="disclosure"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /<div[^>]*data-expanded="true"[^>]*data-slot="disclosure-content"|data-slot="disclosure-content"[^>]*data-expanded="true"/);
  assert.match(html, /<svg[^>]*class="disclosure__indicator"[^>]*data-expanded="true"|<svg[^>]*data-expanded="true"[^>]*class="disclosure__indicator"/);
  assert.match(html, /Hidden content revealed on expand\./);
});

test("disclosure SSR: collapsed panel is hidden, classes + slots", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /class="disclosure"/);
  for (const c of ["disclosure__heading", "disclosure__trigger", "disclosure__content", "disclosure__body", "disclosure__body-inner", "disclosure__indicator"])
    assert.match(html, new RegExp(c));
  const panel = html.match(/<div[^>]*data-slot="disclosure-content"[^>]*>/)![0];
  assert.match(panel, /\shidden/);
  assert.doesNotMatch(panel, /data-expanded/);
});
