// Server-target suite: `Navbar` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public Navbar docs): landmark +
// part classes / slots, items as `a` / `button`, `aria-current` / `data-current`, menu markup (closed: no `data-open`;
// `defaultMenuOpen`: open + `data-menu-open`), toggle aria wiring, hide-on-scroll attributes, `--navbar-height`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Navbar } from "../src/components/navbar/index.ts";

const Fixture = (props: { defaultMenuOpen?: boolean; hideOnScroll?: boolean }) => (
  <Navbar aria-label="Main" defaultMenuOpen={props.defaultMenuOpen} hideOnScroll={props.hideOnScroll} position="static">
    <Navbar.Header>
      <Navbar.MenuToggle />
      <Navbar.Brand>Acme</Navbar.Brand>
      <Navbar.Content>
        <Navbar.Item href="/docs" isCurrent>
          Docs
        </Navbar.Item>
        <Navbar.Item>Action</Navbar.Item>
      </Navbar.Content>
    </Navbar.Header>
    <Navbar.Menu>
      <Navbar.MenuItem href="/docs">Docs</Navbar.MenuItem>
    </Navbar.Menu>
  </Navbar>
);

test("navbar SSR: landmark, parts, items, closed menu", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /<nav[^>]*class="navbar navbar--static"/);
  assert.match(html, /aria-label="Main"/);
  assert.match(html, /--navbar-height: ?4rem/);
  assert.match(html, /<header[^>]*class="navbar__header navbar__header--max-lg navbar__header--md"/);
  assert.match(html, /<a[^>]*aria-current="page"[^>]*>|<a[^>]*data-current="true"/);
  assert.match(html, /data-current="true"/);
  assert.match(html, /<button[^>]*class="navbar__item"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-label="Toggle navigation menu"/);
  assert.match(html, /data-slot="navbar-menu"/);
  assert.doesNotMatch(html, /data-open="true"/);
  assert.doesNotMatch(html, /data-menu-open/);
  assert.doesNotMatch(html, /data-hide-on-scroll/);
  const id = /<div[^>]*id="([^"]+)"[^>]*data-slot="navbar-menu"|data-slot="navbar-menu"[^>]*id="([^"]+)"/.exec(html);
  const menuId = id?.[1] ?? id?.[2];
  assert.ok(menuId);
  assert.match(html, new RegExp(`aria-controls="${menuId}"`));
});

test("navbar SSR: defaultMenuOpen + hideOnScroll attributes", async () => {
  const html = await renderToString(() => <Fixture defaultMenuOpen hideOnScroll />);
  assert.match(html, /data-menu-open="true"/);
  assert.match(html, /data-open="true"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /data-hide-on-scroll="true"/);
  assert.doesNotMatch(html, /data-hide-mode/);
  assert.doesNotMatch(html, /data-hidden/);
});
