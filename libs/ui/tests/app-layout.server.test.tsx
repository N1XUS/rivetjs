// Server-target suite: `AppLayout` SSR (Rivet addition; feature set inspired by HeroUI Pro's public AppLayout docs,
// independent implementation): wrapper + sidebar (provider defaults: collapsible icon, side, variant) + body parts, aside
// state from `defaultAsideOpen` (cookie-driven SSR), scroll mode, resizable handles' ARIA + width variables, no sheet markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { AppLayout, Sidebar, asideCookieOpen } from "../index.ts";

const Nav = () => (
  <Sidebar>
    <Sidebar.Content>nav</Sidebar.Content>
  </Sidebar>
);

test("app-layout SSR: scaffold markup + provider defaults", async () => {
  const html = await renderToString(() => (
    <AppLayout
      id="L"
      sidebar={() => <Nav />}
      defaultSidebarOpen={false}
      sidebarVariant="floating"
      navbar={() => <AppLayout.AsideTrigger />}
      aside={() => <p>aside</p>}
    >
      <p>main</p>
    </AppLayout>
  ));
  assert.match(html, /data-app-layout="L"/);
  assert.match(html, /class="sidebar-wrapper app-layout app-layout--scroll-page"/);
  const sidebar = html.match(/<div[^>]*data-slot="sidebar"[^>]*>/)![0];
  for (const attr of ['data-state="collapsed"', 'data-collapsible="icon"', 'data-variant="floating"', 'data-side="left"'])
    assert.ok(sidebar.includes(attr), attr);
  assert.match(html, /<header[^>]*class="app-layout__header"/);
  assert.match(html, /<main[^>]*class="app-layout__main"[^>]*><p>main<\/p>/);
  assert.match(html, /<aside[^>]*id="L-aside"[^>]*data-state="open"/);
  assert.match(html, /aria-controls="L-aside"/);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /app-layout__sheet/);
});

test("app-layout SSR: aside closed from the cookie, content scroll mode", async () => {
  const html = await renderToString(() => (
    <AppLayout scrollMode="content" defaultAsideOpen={asideCookieOpen("aside_state=false") ?? true} aside={() => <p>aside</p>}>
      x
    </AppLayout>
  ));
  assert.match(html, /app-layout--scroll-content/);
  assert.match(html, /data-scroll-mode="content"/);
  assert.match(html, /<aside[^>]*data-state="closed"[^>]*inert|<aside[^>]*inert[^>]*data-state="closed"/);
});

test("app-layout SSR: resizable handles + width variables", async () => {
  const html = await renderToString(() => (
    <AppLayout sidebar={() => <Nav />} sidebarResizable sidebarDefaultSize={22} aside={() => <p>a</p>} asideResizable>
      x
    </AppLayout>
  ));
  assert.match(html, /--sidebar-width: ?clamp\(12cqw, 22cqw, 30cqw\)/);
  assert.match(html, /--app-layout-aside-width: ?clamp\(15cqw, 20cqw, 40cqw\)/);
  assert.match(html, /role="separator"[^>]*aria-label="Resize sidebar"[^>]*aria-valuenow="22"/);
  assert.match(html, /aria-label="Resize aside"/);
});

test("app-layout SSR: contained forwards to the sidebar provider without leaking a DOM attribute", async () => {
  const html = await renderToString(() => (
    <AppLayout contained class="h-[760px]" sidebar={() => <Nav />} aside={() => <p>Details</p>}>
      Main
    </AppLayout>
  ));
  assert.match(html, /sidebar-wrapper--contained/);
  assert.match(html, /h-\[760px\]/);
  assert.doesNotMatch(html, / contained[= >]/);
});
