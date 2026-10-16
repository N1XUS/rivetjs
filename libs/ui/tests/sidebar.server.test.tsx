// Server-target suite: `Sidebar` SSR — wrapper + desktop panel markup with HeroUI-style classes and shadcn data attributes
// (`data-state`, `data-collapsible`, `data-variant`, `data-side`), the `--sidebar-width` CSS variables on the wrapper,
// `defaultOpen={false}` renders collapsed, menu-button sizes / outline / active, trigger icon + visually hidden (inline style) label; no mobile sheet
// in the server HTML.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Sidebar } from "../index.ts";

const Fixture = (props: { defaultOpen?: boolean }) => (
  <Sidebar.Provider defaultOpen={props.defaultOpen}>
    <Sidebar collapsible="icon" variant="inset" side="right">
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Platform</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive size="sm" variant="outline">
                Playground
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
    </Sidebar>
    <Sidebar.Inset>
      <Sidebar.Trigger />
    </Sidebar.Inset>
  </Sidebar.Provider>
);

test("sidebar SSR: wrapper, panel, data attributes and HeroUI classes", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /class="sidebar-wrapper"/);
  assert.match(html, /--sidebar-width:\s*16rem/);
  assert.match(html, /class="sidebar"[^>]*data-state="expanded"/);
  assert.match(html, /data-variant="inset"/);
  assert.match(html, /data-side="right"/);
  assert.match(html, /class="sidebar__gap"/);
  assert.match(html, /class="sidebar__container"/);
  assert.match(html, /class="sidebar__inner"/);
  assert.match(html, /class="sidebar__group-label"[^>]*>Platform</);
  assert.match(html, /class="sidebar__menu-button sidebar__menu-button--sm sidebar__menu-button--outline"/);
  assert.match(html, /data-active="true"/);
  assert.match(html, /class="sidebar__inset"/);
  assert.match(html, /data-slot="sidebar-trigger-icon"/);
  assert.match(html, /<span style="[^"]*position: ?absolute[^"]*">Toggle Sidebar<\/span>/);
  assert.doesNotMatch(html, /sr-only/);
  assert.doesNotMatch(html, /sidebar__sheet/);
});

test("sidebar SSR: defaultOpen false renders collapsed (icon)", async () => {
  const html = await renderToString(() => <Fixture defaultOpen={false} />);
  assert.match(html, /data-state="collapsed"/);
  assert.match(html, /data-collapsible="icon"/);
});
