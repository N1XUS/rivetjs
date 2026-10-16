// DOM-target suite: `Sidebar` (Rivet addition: shadcn/ui Sidebar behaviour from `@rivetjs/cdk/sidebar`, HeroUI look) on
// happy-dom: index exports + compound parts, HeroUI-style BEM classes on every part (wrapper / sidebar / container / gap / inner,
// menu, menu-button sizes + outline, sub buttons, badge, action, skeleton, group parts, input, separator, trigger), `class`
// merged, trigger toggles `data-state` expanded <-> collapsed with the default lucide PanelLeft icon + visually hidden label, controlled
// `open` signal. Resumed behaviour (cookie, keyboard shortcut, mobile sheet, collapsed tooltips): `tests-components/sidebar.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Sidebar, SidebarRoot, SidebarProvider, SidebarMenuButton, sidebarVariants, useSidebar } = await import("../src/components/sidebar/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

const Fixture = (props: { open?: ReturnType<typeof signal<boolean>>; variant?: "sidebar" | "floating" | "inset" }) => (
  <Sidebar.Provider open={props.open} class="custom-wrapper">
    <Sidebar variant={props.variant} collapsible="icon" class="custom-panel">
      <Sidebar.Header>
        <Sidebar.Input placeholder="Search" />
      </Sidebar.Header>
      <Sidebar.Separator />
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
          <Sidebar.GroupAction aria-label="Add project">+</Sidebar.GroupAction>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="home" isActive>
                  <span>Home</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuBadge>24</Sidebar.MenuBadge>
                <Sidebar.MenuAction aria-label="More" showOnHover>
                  ...
                </Sidebar.MenuAction>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="large" size="lg" variant="outline">
                  <span>Large</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton id="sub" href="#sub" size="sm">
                      Sub
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuSkeleton showIcon />
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>Footer</Sidebar.Footer>
      <Sidebar.Rail />
    </Sidebar>
    <Sidebar.Inset>
      <Sidebar.Trigger id="trigger" />
    </Sidebar.Inset>
  </Sidebar.Provider>
);

const q = (root: ParentNode, selector: string) => root.querySelector(selector) as HTMLElement;
const cls = (root: ParentNode, slot: string) => q(root, `[data-slot="${slot}"]`)?.className ?? "";

test("sidebar: index exports", () => {
  assert.equal(Sidebar, SidebarRoot);
  assert.equal(Sidebar.Root, SidebarRoot);
  assert.equal(Sidebar.Provider, SidebarProvider);
  assert.equal(Sidebar.MenuButton, SidebarMenuButton);
  assert.equal(typeof useSidebar, "function");
  assert.equal(sidebarVariants().root(), "sidebar");
  assert.equal(sidebarVariants().wrapper(), "sidebar-wrapper");
  assert.equal(sidebarVariants({ size: "lg" }).menuButton(), "sidebar__menu-button sidebar__menu-button--lg");
  assert.equal(sidebarVariants({ variant: "outline" }).menuButton(), "sidebar__menu-button sidebar__menu-button--outline");
});

test("sidebar: HeroUI-style classes on every part, class merged", async () => {
  const r = render(() => <Fixture />);
  await flush();
  const c = r.container;
  assert.match(cls(c, "sidebar-wrapper"), /^sidebar-wrapper custom-wrapper/);
  const root = q(c, '[data-slot="sidebar"]');
  assert.match(root.className, /^sidebar\b/);
  assert.equal(root.getAttribute("data-state"), "expanded");
  assert.equal(root.getAttribute("data-collapsible"), "");
  assert.equal(root.getAttribute("data-variant"), "sidebar");
  assert.match(cls(c, "sidebar-gap"), /sidebar__gap/);
  assert.match(cls(c, "sidebar-container"), /^sidebar__container custom-panel/);
  assert.match(cls(c, "sidebar-inner"), /sidebar__inner/);
  assert.match(cls(c, "sidebar-header"), /sidebar__header/);
  assert.match(cls(c, "sidebar-input"), /sidebar__input/);
  assert.match(cls(c, "sidebar-input"), /\binput\b/);
  assert.match(cls(c, "sidebar-separator"), /sidebar__separator/);
  assert.match(cls(c, "sidebar-content"), /sidebar__content/);
  assert.match(cls(c, "sidebar-group"), /sidebar__group/);
  assert.match(cls(c, "sidebar-group-label"), /sidebar__group-label/);
  assert.match(cls(c, "sidebar-group-action"), /sidebar__group-action/);
  assert.match(cls(c, "sidebar-group-content"), /sidebar__group-content/);
  assert.match(cls(c, "sidebar-menu"), /sidebar__menu/);
  assert.match(cls(c, "sidebar-menu-item"), /sidebar__menu-item/);
  assert.match(cls(c, "sidebar-menu-badge"), /sidebar__menu-badge/);
  assert.match(cls(c, "sidebar-menu-action"), /sidebar__menu-action/);
  assert.match(cls(c, "sidebar-menu-sub"), /sidebar__menu-sub/);
  assert.match(cls(c, "sidebar-menu-sub-item"), /sidebar__menu-sub-item/);
  assert.match(cls(c, "sidebar-menu-skeleton"), /sidebar__menu-skeleton/);
  assert.match(cls(c, "sidebar-footer"), /sidebar__footer/);
  assert.match(cls(c, "sidebar-rail"), /sidebar__rail/);
  assert.match(cls(c, "sidebar-inset"), /sidebar__inset/);

  const home = q(c, "#home");
  assert.equal(home.className, "sidebar__menu-button");
  assert.equal(home.getAttribute("data-active"), "true");
  assert.equal(home.getAttribute("data-size"), "default");
  const large = q(c, "#large");
  assert.equal(large.className, "sidebar__menu-button sidebar__menu-button--lg sidebar__menu-button--outline");
  assert.equal(large.getAttribute("data-size"), "lg");
  assert.equal(large.getAttribute("data-active"), null);
  const sub = q(c, "#sub");
  assert.equal(sub.tagName, "A");
  assert.match(sub.className, /sidebar__menu-sub-button sidebar__menu-sub-button--sm/);
  r.unmount();
});

test("sidebar: trigger toggles expanded <-> collapsed; default PanelLeft icon + visually hidden label", async () => {
  const r = render(() => <Fixture variant="floating" />);
  await flush();
  const c = r.container;
  const trigger = q(c, "#trigger");
  assert.match(trigger.className, /sidebar__trigger/);
  assert.ok(trigger.querySelector('svg[data-slot="sidebar-trigger-icon"]'));
  const label = q(trigger, "span");
  assert.equal(label.textContent, "Toggle Sidebar");
  assert.equal(label.style.position, "absolute");
  assert.equal(label.style.width, "1px");
  const root = q(c, '[data-slot="sidebar"]');
  assert.equal(root.getAttribute("data-variant"), "floating");
  trigger.click();
  await flush();
  assert.equal(root.getAttribute("data-state"), "collapsed");
  assert.equal(root.getAttribute("data-collapsible"), "icon");
  trigger.click();
  await flush();
  assert.equal(root.getAttribute("data-state"), "expanded");
  r.unmount();
});

test("sidebar: controlled open signal both ways", async () => {
  const open = signal(true);
  const r = render(() => <Fixture open={open} />);
  await flush();
  const root = q(r.container, '[data-slot="sidebar"]');
  open.set(false);
  await flush();
  assert.equal(root.getAttribute("data-state"), "collapsed");
  q(r.container, "#trigger").click();
  await flush();
  assert.equal(open(), true);
  assert.equal(root.getAttribute("data-state"), "expanded");
  r.unmount();
});

test("sidebar: collapsible none renders the static panel with the root class", async () => {
  const r = render(() => (
    <Sidebar.Provider>
      <Sidebar collapsible="none" class="w-64">
        <Sidebar.Content>x</Sidebar.Content>
      </Sidebar>
    </Sidebar.Provider>
  ));
  await flush();
  const root = q(r.container, '[data-slot="sidebar"]');
  assert.equal(root.className, "sidebar w-64");
  assert.equal(r.container.querySelector('[data-slot="sidebar-container"]'), null);
  r.unmount();
});

test("sidebar extensions: tree trigger / indicator / sub panel, actions, chip, pages, guide lines", async () => {
  const r = render(() => (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Pages>
            <Sidebar.Page value="main">
              <Sidebar.Menu showGuideLines="hover">
                <Sidebar.MenuItem id="tree" defaultExpanded>
                  <Sidebar.MenuTrigger id="tree-trigger">
                    <span>Projects</span>
                    <Sidebar.MenuIndicator />
                  </Sidebar.MenuTrigger>
                  <Sidebar.MenuSub>
                    <Sidebar.MenuSubItem>
                      <Sidebar.MenuSubButton href="#a" isCurrent>
                        A
                      </Sidebar.MenuSubButton>
                    </Sidebar.MenuSubItem>
                  </Sidebar.MenuSub>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton>Inbox</Sidebar.MenuButton>
                  <Sidebar.MenuChip id="chip" color="success">
                    New
                  </Sidebar.MenuChip>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton>Item</Sidebar.MenuButton>
                  <Sidebar.MenuActions id="actions" showOnHover>
                    <Sidebar.MenuAction aria-label="Edit">e</Sidebar.MenuAction>
                    <Sidebar.MenuAction aria-label="Delete">d</Sidebar.MenuAction>
                  </Sidebar.MenuActions>
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.Page>
            <Sidebar.Page value="settings">Settings</Sidebar.Page>
          </Sidebar.Pages>
        </Sidebar.Content>
      </Sidebar>
    </Sidebar.Provider>
  ));
  await flush();
  const trigger = q(r.container, "#tree-trigger");
  assert.match(trigger.className, /sidebar__menu-button/);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const indicator = q(r.container, '[data-slot="sidebar-menu-indicator"]');
  assert.equal(indicator.className, "sidebar__menu-indicator");
  assert.ok(indicator.querySelector("svg"), "default lucide ChevronRight");
  const panel = q(r.container, '[data-slot="sidebar-menu-sub-panel"]');
  assert.equal(panel.className, "sidebar__menu-sub-panel");
  assert.equal(q(r.container, '[data-slot="sidebar-menu"]').getAttribute("data-guide-lines"), "hover");
  const chip = q(r.container, "#chip");
  assert.equal(chip.getAttribute("data-slot"), "sidebar-menu-badge");
  assert.match(chip.className, /\bchip\b/);
  assert.match(chip.className, /chip--success/);
  assert.match(chip.className, /sidebar__menu-chip/);
  const actions = q(r.container, "#actions");
  assert.equal(actions.className, "sidebar__menu-actions");
  assert.equal(actions.querySelectorAll("button").length, 2);
  const pages = q(r.container, '[data-slot="sidebar-pages"]');
  assert.equal(pages.className, "sidebar__pages");
  const [main, settings] = Array.from(pages.querySelectorAll<HTMLElement>('[data-slot="sidebar-page"]'));
  assert.equal(main!.className, "sidebar__page");
  assert.equal(main!.hasAttribute("hidden"), false);
  assert.equal(settings!.hasAttribute("hidden"), true);
  assert.equal(q(r.container, '[aria-current="page"]').textContent?.trim(), "A");
  trigger.click();
  await flush();
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  r.unmount();
});
