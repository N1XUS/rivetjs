// DOM-target suite: `AppLayout` (Rivet addition; feature set inspired by HeroUI Pro's public AppLayout docs, independent
// implementation): scaffold markup (wrapper + sidebar + body / header / main / aside / toolbar / footer), provider defaults
// reach the `<Sidebar>` (collapsible icon default, side / variant), sidebar controlled state, aside open state (trigger,
// controlled Signal, onAsideOpenChange, `useAppLayout`, cookie), aside shortcut, MenuToggle, resizable handles (ARIA +
// keyboard), MobileAside renders only in the sheet, `asideCookieOpen`, index exports.
import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/app-layout/index.ts");
const { Sidebar } = await import("../src/components/sidebar/index.ts");
const { AppLayout, useAppLayout, asideCookieOpen } = ui;

beforeEach(() => {
  document.body.innerHTML = "";
});

const flush = () => new Promise((r) => setTimeout(r, 20));
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );

const Nav = () => (
  <Sidebar>
    <Sidebar.Content>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Home</Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Content>
  </Sidebar>
);

test("markup: wrapper, sidebar with provider defaults, body parts in order", () => {
  const r = render(() => (
    <AppLayout
      id="L"
      sidebar={() => <Nav />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle id="L-menu" />
          <span>Title</span>
          <AppLayout.AsideTrigger id="L-aside-trigger" />
        </>
      )}
      toolbar={() => <span>Tools</span>}
      aside={() => <p>Details</p>}
      footer={() => <span>Foot</span>}
    >
      <p id="page">Page</p>
    </AppLayout>
  ));
  const root = q('[data-app-layout="L"]')!;
  assert.equal(root.getAttribute("data-slot"), "sidebar-wrapper");
  assert.match(root.className, /\bapp-layout\b/);
  assert.match(root.className, /app-layout--scroll-page/);
  assert.equal(root.getAttribute("data-scroll-mode"), "page");
  const sidebar = q('[data-slot="sidebar"]')!;
  assert.equal(sidebar.getAttribute("data-collapsible"), "", "expanded: no collapsible attr");
  assert.equal(sidebar.getAttribute("data-side"), "left");
  assert.equal(sidebar.getAttribute("data-variant"), "sidebar");
  const body = q('[data-slot="app-layout-body"]')!;
  assert.match(body.className, /sidebar__inset/);
  assert.deepEqual(
    [...body.children].map((c) => c.getAttribute("data-slot")),
    ["app-layout-header", "app-layout-toolbar", "app-layout-content", "app-layout-footer"],
  );
  assert.equal(q('[data-slot="app-layout-main"]')!.tagName, "MAIN");
  assert.equal(q("#page")!.closest("main"), q('[data-slot="app-layout-main"]'));
  const aside = q('[data-slot="app-layout-aside"]')!;
  assert.equal(aside.tagName, "ASIDE");
  assert.equal(aside.id, "L-aside");
  assert.equal(aside.getAttribute("aria-label"), "Details");
  assert.equal(aside.getAttribute("data-state"), "open");
  assert.equal(q(".app-layout__menu-toggle")!.getAttribute("data-slot"), "sidebar-trigger");
  assert.ok(q('[data-slot="app-layout-menu-toggle-icon"]'));
  assert.equal(q("#L-menu"), q(".app-layout__menu-toggle"));
  assert.equal(q("#L-aside-trigger")!.getAttribute("data-slot"), "app-layout-aside-trigger");
  r.unmount();
});

test("sidebar: collapsible icon default, side / variant / collapsible forwarded, controlled open", async () => {
  const open = signal(true);
  const r = render(() => (
    <AppLayout sidebar={() => <Nav />} sidebarOpen={open} sidebarSide="right" sidebarVariant="inset" navbar={() => <AppLayout.MenuToggle />}>
      x
    </AppLayout>
  ));
  const sidebar = q('[data-slot="sidebar"]')!;
  assert.equal(sidebar.getAttribute("data-side"), "right");
  assert.equal(sidebar.getAttribute("data-variant"), "inset");
  assert.equal(q("[data-app-layout]")!.getAttribute("data-sidebar-side"), "right");
  open.set(false);
  await flush();
  assert.equal(sidebar.getAttribute("data-state"), "collapsed");
  assert.equal(sidebar.getAttribute("data-collapsible"), "icon");
  r.unmount();
  const o = render(() => (
    <AppLayout sidebar={() => <Nav />} defaultSidebarOpen={false} sidebarCollapsible="offcanvas">
      x
    </AppLayout>
  ));
  assert.equal(q('[data-slot="sidebar"]')!.getAttribute("data-collapsible"), "offcanvas");
  o.unmount();
});

test("aside: trigger toggles (aria-expanded, data-state, inert), onAsideOpenChange, cookie, useAppLayout", async () => {
  const calls: boolean[] = [];
  let api!: ReturnType<typeof useAppLayout>;
  const Probe = () => {
    api = useAppLayout();
    return null;
  };
  const r = render(() => (
    <AppLayout navbar={() => <AppLayout.AsideTrigger />} aside={() => <p>Details</p>} onAsideOpenChange={(o) => calls.push(o)}>
      <Probe />
    </AppLayout>
  ));
  const trigger = q('[data-slot="app-layout-aside-trigger"]')!;
  const aside = q('[data-slot="app-layout-aside"]')!;
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(trigger.getAttribute("aria-controls"), aside.id);
  assert.equal(trigger.getAttribute("data-state"), "open");
  assert.equal(trigger.getAttribute("aria-label"), "Hide panel");
  trigger.click();
  await flush();
  assert.deepEqual(calls, [false]);
  assert.equal(aside.getAttribute("data-state"), "closed");
  assert.ok(aside.hasAttribute("inert"));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(trigger.getAttribute("aria-label"), "Show panel");
  assert.equal(trigger.getAttribute("data-state"), "closed");
  assert.match(document.cookie, /aside_state=false/);
  assert.equal(api!.isAsideOpen(), false);
  api!.toggleAside();
  await flush();
  assert.equal(aside.getAttribute("data-state"), "open");
  api!.setAsideOpen(false);
  await flush();
  assert.equal(aside.getAttribute("data-state"), "closed");
  r.unmount();
  let outside: unknown = "unset";
  const o = render(() => {
    outside = useAppLayout();
    return null;
  });
  assert.equal(outside, null);
  o.unmount();
});

test("aside: controlled Signal, defaultAsideOpen false, no aside → no column", async () => {
  const open = signal(false);
  const r = render(() => (
    <AppLayout aside={() => <p>D</p>} asideOpen={open}>
      x
    </AppLayout>
  ));
  assert.equal(q('[data-slot="app-layout-aside"]')!.getAttribute("data-state"), "closed");
  open.set(true);
  await flush();
  assert.equal(q('[data-slot="app-layout-aside"]')!.getAttribute("data-state"), "open");
  r.unmount();
  const n = render(() => <AppLayout>x</AppLayout>);
  assert.equal(q('[data-slot="app-layout-aside"]'), null);
  assert.equal(q('[data-slot="app-layout-toolbar"]'), null);
  assert.equal(q('[data-slot="app-layout-footer"]'), null);
  n.unmount();
});

test("aside shortcut: off by default, asideToggleShortcut toggles from inside the layout", async () => {
  const r = render(() => (
    <AppLayout aside={() => <p>D</p>} asideToggleShortcut="mod+shift+e">
      <button id="inside">in</button>
    </AppLayout>
  ));
  key(q("#inside")!, { key: "e", code: "KeyE", ctrlKey: true, shiftKey: true });
  await flush();
  assert.equal(q('[data-slot="app-layout-aside"]')!.getAttribute("data-state"), "closed");
  r.unmount();
  const d = render(() => (
    <AppLayout aside={() => <p>D</p>}>
      <button id="inside2">in</button>
    </AppLayout>
  ));
  key(q("#inside2")!, { key: "e", code: "KeyE", ctrlKey: true, shiftKey: true });
  await flush();
  assert.equal(q('[data-slot="app-layout-aside"]')!.getAttribute("data-state"), "open");
  d.unmount();
});

test("resizable: window-splitter handles (ARIA, default size variable, keyboard Home / End / Enter)", async () => {
  const r = render(() => (
    <AppLayout id="R" sidebar={() => <Nav />} sidebarResizable aside={() => <p>D</p>} asideResizable asideDefaultSize="300px">
      x
    </AppLayout>
  ));
  const root = q('[data-app-layout="R"]')!;
  assert.equal(root.style.getPropertyValue("--sidebar-width"), "clamp(12cqw, 18cqw, 30cqw)");
  const sh = q('[data-slot="app-layout-sidebar-handle"]')!;
  assert.equal(sh.getAttribute("role"), "separator");
  assert.equal(sh.getAttribute("aria-orientation"), "vertical");
  assert.equal(sh.getAttribute("aria-valuenow"), "18");
  assert.equal(sh.getAttribute("aria-valuemin"), "12");
  assert.equal(sh.getAttribute("aria-valuemax"), "30");
  assert.equal(sh.getAttribute("tabindex"), "0");
  const ah = q('[data-slot="app-layout-aside-handle"]')!;
  assert.equal(ah.getAttribute("aria-controls"), "R-aside");
  assert.equal(ah.hasAttribute("aria-valuenow"), false, "string size: unknown percent");
  assert.equal(q('[data-slot="app-layout-aside"]')!.style.getPropertyValue("--app-layout-aside-width"), "clamp(15cqw, 300px, 40cqw)");
  // happy-dom layout width is 0 → keyboard resizes are no-ops except Enter (reset).
  key(sh, { key: "Enter" });
  await flush();
  assert.equal(sh.getAttribute("aria-valuenow"), "18");
  r.unmount();
});

test("asideMobile sheet: MobileAside children only in the sheet; trigger marked data-sheet", async () => {
  const r = render(() => (
    <AppLayout
      asideMobile="sheet"
      navbar={() => <AppLayout.AsideTrigger />}
      aside={() => (
        <>
          <p class="both">Both</p>
          <AppLayout.MobileAside>
            <p class="sheet-only">Sheet</p>
          </AppLayout.MobileAside>
        </>
      )}
    >
      x
    </AppLayout>
  ));
  assert.ok(q(".both"));
  assert.equal(q(".sheet-only"), null, "closed sheet + desktop aside: no MobileAside content");
  assert.equal(q('[data-slot="app-layout-aside-trigger"]')!.getAttribute("data-sheet"), "true");
  assert.equal(q("[data-app-layout]")!.getAttribute("data-aside-mobile"), "sheet");
  r.unmount();
});

test("asideCookieOpen + index exports", () => {
  assert.equal(asideCookieOpen("a=1; aside_state=false"), false);
  assert.equal(asideCookieOpen("true"), true);
  assert.equal(asideCookieOpen({ get: (n: string) => (n === "aside_state" ? "true" : undefined) }), true);
  assert.equal(asideCookieOpen(undefined), undefined);
  for (const k of ["Root", "MenuToggle", "AsideTrigger", "MobileAside"])
    assert.equal(typeof (AppLayout as unknown as Record<string, unknown>)[k], "function", k);
  assert.equal(ui.AppLayoutRoot, AppLayout);
  assert.equal(typeof ui.appLayoutVariants, "function");
  assert.equal(ui.ASIDE_BREAKPOINT, 1024);
});
