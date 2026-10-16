// Server-target suite: `DisclosureGroup` SSR (upstream disclosure-group.ssr.test.tsx: `defaultExpandedKeys` renders
// `data-slot="disclosure-group"` + `aria-expanded="true"`). Rivet: BEM block, only the default key's panel visible.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Disclosure, DisclosureGroup } from "../index.ts";

test("disclosure-group SSR: one expanded item (upstream)", async () => {
  const html = await renderToString(() => (
    <DisclosureGroup data-testid="disclosure-group" defaultExpandedKeys={["preview"]}>
      <Disclosure aria-label="Preview" id="preview">
        <Disclosure.Heading>
          <Disclosure.Trigger>
            Preview
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body>Preview content</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      <Disclosure aria-label="Download" id="download">
        <Disclosure.Heading>
          <Disclosure.Trigger>
            Download
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body>Download content</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </DisclosureGroup>
  ));
  assert.match(html, /data-slot="disclosure-group"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /class="disclosure-group"/);
  assert.equal(html.match(/aria-expanded="true"/g)!.length, 1);
  assert.equal(html.match(/aria-expanded="false"/g)!.length, 1);
});
