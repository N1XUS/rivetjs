// DOM-target suite (happy-dom): `Navbar` (Rivet-authored; feature set inspired by HeroUI Pro's public Navbar docs). Exports +
// variants, landmark + part classes / slots, position / size / maxWidth modifiers, `--navbar-height`, items as links /
// buttons, `isCurrent` (value + accessor) → `aria-current` / `data-current`, external links, `forceReload`, menu toggle
// (`aria-expanded` / `aria-controls` / `data-selected`, `data-menu-open` + menu `data-open`), MenuItem closes the menu,
// Escape closes, controlled `isMenuOpen` signal + `onMenuOpenChange`, `useNavbar`, `navigate` client routing, JS scroll
// fallback hides / reveals, parts outside a Navbar.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Navbar, NavbarRoot, navbarVariants, useNavbar } = await import("../src/components/navbar/index.ts");
const { navbarScrolled } = await import("../src/components/navbar/navbar-state.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  );

const Fixture = (props: {
  isMenuOpen?: ReturnType<typeof signal<boolean>>;
  onMenuOpenChange?: (o: boolean) => void;
  current?: () => boolean;
  navigate?: (p: string) => void;
}) => (
  <Navbar aria-label="Main" isMenuOpen={props.isMenuOpen} onMenuOpenChange={props.onMenuOpenChange} navigate={props.navigate as never}>
    <Navbar.Header>
      <Navbar.MenuToggle />
      <Navbar.Brand>Acme</Navbar.Brand>
      <Navbar.Content>
        <Navbar.Item href="/docs" isCurrent={props.current ?? true}>
          <Navbar.Label>Docs</Navbar.Label>
        </Navbar.Item>
        <Navbar.Item href="https://example.com">External</Navbar.Item>
        <Navbar.Item href="/legacy" forceReload>
          Legacy
        </Navbar.Item>
        <Navbar.Separator />
        <Navbar.Item onPress={() => {}}>Action</Navbar.Item>
      </Navbar.Content>
      <Navbar.Spacer />
    </Navbar.Header>
    <Navbar.Menu>
      <Navbar.MenuItem href="/docs" isCurrent>
        Docs
      </Navbar.MenuItem>
      <Navbar.MenuItem href="/blog">Blog</Navbar.MenuItem>
    </Navbar.Menu>
  </Navbar>
);

test("navbar: exports + variants", () => {
  assert.equal(Navbar, NavbarRoot);
  assert.equal(Navbar.Root, NavbarRoot);
  assert.equal(navbarVariants().base(), "navbar navbar--sticky");
  assert.equal(navbarVariants().header(), "navbar__header navbar__header--max-lg navbar__header--md");
  assert.equal(navbarVariants({ size: "sm" }).item(), "navbar__item navbar__item--sm");
});

test("navbar: landmark, parts, classes, slots, height variable", () => {
  const r = render(() => <Fixture />);
  const nav = r.container.querySelector("nav")!;
  assert.equal(nav.getAttribute("aria-label"), "Main");
  assert.equal(nav.className, "navbar navbar--sticky");
  assert.equal(nav.getAttribute("data-slot"), "navbar");
  assert.equal(nav.style.getPropertyValue("--navbar-height"), "4rem");
  assert.equal(nav.getAttribute("data-block-scroll"), "true");
  assert.equal(nav.hasAttribute("data-menu-open"), false);
  assert.equal(q("header")!.className, "navbar__header navbar__header--max-lg navbar__header--md");
  assert.equal(q("[data-slot=navbar-brand]")!.className, "navbar__brand");
  assert.equal(q("[data-slot=navbar-content]")!.className, "navbar__content");
  assert.equal(q("[data-slot=navbar-spacer]")!.className, "navbar__spacer");
  assert.equal(q("[data-slot=navbar-label]")!.className, "navbar__label");
  const sep = q("[data-slot=separator]")!;
  assert.match(sep.className, /navbar__separator/);
  assert.equal(sep.getAttribute("data-orientation"), "vertical");
  r.unmount();
});

test("navbar: position / size / maxWidth / height modifiers", () => {
  const r = render(() => (
    <Navbar position="floating" size="lg" maxWidth="full" height="5rem" class="x">
      <Navbar.Header>
        <Navbar.Item href="/">Home</Navbar.Item>
        <Navbar.MenuToggle />
      </Navbar.Header>
      <Navbar.Menu>
        <Navbar.MenuItem href="/">Home</Navbar.MenuItem>
      </Navbar.Menu>
    </Navbar>
  ));
  const nav = r.container.querySelector("nav")!;
  assert.equal(nav.className, "navbar navbar--floating x");
  assert.equal(nav.style.getPropertyValue("--navbar-height"), "5rem");
  assert.equal(q("header")!.className, "navbar__header navbar__header--max-full navbar__header--lg");
  assert.equal(q("[data-slot=navbar-item]")!.className, "navbar__item navbar__item--lg");
  assert.equal(q("[data-slot=navbar-menu-toggle]")!.className, "navbar__menu-toggle navbar__menu-toggle--lg");
  assert.equal(q("[data-slot=navbar-menu-item]")!.className, "navbar__menu-item navbar__menu-item--lg");
  r.unmount();
});

test("navbar items: links / buttons, isCurrent, external, forceReload", () => {
  const cur = signal(true);
  const r = render(() => <Fixture current={() => cur()} />);
  const items = [...r.container.querySelectorAll<HTMLElement>("[data-slot=navbar-item]")];
  assert.deepEqual(
    items.map((i) => i.tagName),
    ["A", "A", "A", "BUTTON"],
  );
  assert.equal(items[0]!.getAttribute("aria-current"), "page");
  assert.equal(items[0]!.getAttribute("data-current"), "true");
  cur.set(false);
  return flush().then(() => {
    assert.equal(items[0]!.hasAttribute("aria-current"), false);
    assert.equal(items[0]!.hasAttribute("data-current"), false);
    assert.equal(items[1]!.getAttribute("target"), "_blank");
    assert.equal(items[1]!.getAttribute("rel"), "noopener noreferrer");
    assert.equal(items[2]!.getAttribute("data-rivet-reload"), "");
    assert.equal(items[3]!.className, "navbar__item");
    r.unmount();
  });
});

test("navbar menu: toggle opens / closes, aria wiring, MenuItem closes, Escape closes", async () => {
  const calls: boolean[] = [];
  const r = render(() => <Fixture onMenuOpenChange={(o) => calls.push(o)} />);
  const nav = r.container.querySelector("nav")!;
  const toggle = q("[data-slot=navbar-menu-toggle]")!;
  const menu = q("[data-slot=navbar-menu]")!;
  assert.equal(toggle.tagName, "BUTTON");
  assert.equal(toggle.getAttribute("aria-label"), "Toggle navigation menu");
  assert.equal(toggle.getAttribute("aria-controls"), menu.id);
  assert.ok(menu.id);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  const icon = toggle.querySelector("[data-slot=navbar-menu-toggle-icon]")!;
  assert.equal(icon.getAttribute("class"), "morph-burger", "default icon = morph burger (CSS bars)");
  assert.equal(toggle.querySelectorAll("svg").length, 0);
  assert.equal(icon.hasAttribute("data-open"), false);
  assert.equal(menu.hasAttribute("data-open"), false);
  toggle.click();
  await flush();
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(icon.getAttribute("data-open"), "true", "burger morphs to X");
  assert.equal(toggle.getAttribute("data-selected"), "true");
  assert.equal(nav.getAttribute("data-menu-open"), "true");
  assert.equal(menu.getAttribute("data-open"), "true");
  (menu.querySelectorAll("a")[1] as HTMLElement).click();
  await flush();
  assert.equal(menu.hasAttribute("data-open"), false, "MenuItem press closes");
  toggle.click();
  await flush();
  key(menu.querySelector("a")!, "Escape");
  await flush();
  assert.equal(nav.hasAttribute("data-menu-open"), false);
  assert.deepEqual(calls, [true, false, true, false]);
  r.unmount();
});

test("navbar menu: controlled two-way signal; useNavbar", async () => {
  const open = signal(false);
  let api!: ReturnType<typeof useNavbar>;
  const Probe = () => {
    api = useNavbar();
    return null;
  };
  const r = render(() => (
    <Navbar isMenuOpen={open} height="3rem">
      <Probe />
      <Navbar.MenuToggle />
      <Navbar.Menu>m</Navbar.Menu>
    </Navbar>
  ));
  open.set(true);
  await flush();
  assert.equal(q("[data-slot=navbar-menu]")!.getAttribute("data-open"), "true");
  assert.equal(api.isMenuOpen(), true);
  assert.equal(api.height, "3rem");
  assert.equal(api.isHidden(), false);
  api.setMenuOpen(false);
  await flush();
  assert.equal(open(), false);
  q("[data-slot=navbar-menu-toggle]")!.click();
  await flush();
  assert.equal(open(), true);
  r.unmount();
  assert.throws(() => render(() => <Probe />), /within a Navbar/);
});

test("navbar: navigate routes item links client-side", async () => {
  const paths: string[] = [];
  const r = render(() => <Fixture navigate={(p) => paths.push(p)} />);
  const docs = q("[data-slot=navbar-item]")!;
  docs.dispatchEvent(new (window as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  assert.deepEqual(paths, ["/docs"]);
  r.unmount();
});

test("navbar: JS scroll path hides after scrolling down past the bar, reveals on scroll up", () => {
  const state = {
    menu: {
      value: Object.assign(() => false, { set() {} }),
      isControlled: false,
      isSignal: false,
      isAccessor: false,
      onChange: undefined,
      pending: { has: false, v: undefined },
    },
    hidden: signal<boolean | null>(null),
    lastY: signal(0),
    hideOnScroll: true,
    shouldBlockScroll: true,
    height: "4rem",
    menuId: "m",
    parentRef: undefined,
  };
  const nav = document.createElement("nav");
  Object.defineProperty(nav, "offsetHeight", { value: 64 });
  document.body.append(nav);
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    navbarScrolled(state as never, nav, { target: document } as unknown as Event);
  };
  scrollTo(30);
  assert.equal(state.hidden(), false, "within the bar height: shown");
  scrollTo(200);
  assert.equal(state.hidden(), true);
  scrollTo(150);
  assert.equal(state.hidden(), false);
  nav.remove();
});

test("navbar: parts outside a Navbar get only the caller's class", () => {
  const r = render(() => (
    <div>
      <Navbar.Brand class="b">x</Navbar.Brand>
      <Navbar.Content>y</Navbar.Content>
    </div>
  ));
  assert.equal(r.container.querySelector("[data-slot=navbar-brand]")!.className, "b");
  assert.equal(r.container.querySelector("[data-slot=navbar-content]")!.className, "");
  r.unmount();
});
