// DOM-target suite: `Breadcrumbs` (upstream tests/components/breadcrumbs/breadcrumbs.test.tsx ported to happy-dom): data-slot / BEM
// block / list role, items as links with `data-slot`, current page on the last item (no separator, `aria-current=page`), default
// chevron separators, custom separator (node + function), `isDisabled` → `aria-disabled`, `onPress` on a non-current item.
// Rivet: classes of every part, Item outside Breadcrumbs, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Breadcrumbs, BreadcrumbsRoot, BreadcrumbsItem, breadcrumbsVariants } = await import("../src/components/breadcrumbs/index.ts");

const Fixture = (props: { isDisabled?: boolean; separator?: unknown }) => (
  <Breadcrumbs data-testid="breadcrumbs" isDisabled={props.isDisabled} separator={props.separator as never}>
    <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
    <Breadcrumbs.Item href="#products">Products</Breadcrumbs.Item>
    <Breadcrumbs.Item>Laptop</Breadcrumbs.Item>
  </Breadcrumbs>
);

const links = (root: ParentNode) => [...root.querySelectorAll("a, [role=link]")] as HTMLElement[];
const link = (root: ParentNode, name: string) => links(root).find((a) => a.textContent === name)!;

test("breadcrumbs: index exports", () => {
  assert.equal(Breadcrumbs, BreadcrumbsRoot);
  assert.equal(Breadcrumbs.Root, BreadcrumbsRoot);
  assert.equal(Breadcrumbs.Item, BreadcrumbsItem);
  assert.equal(breadcrumbsVariants().base(), "breadcrumbs");
});

test("breadcrumbs: data-slot, BEM block, list role", () => {
  const r = render(() => <Fixture />);
  const root = r.container.querySelector("[data-testid=breadcrumbs]")!;
  assert.equal(root.tagName, "OL");
  assert.equal(root.getAttribute("data-slot"), "breadcrumbs");
  assert.match(root.className, /\bbreadcrumbs\b/);
  assert.equal(root.querySelectorAll("li").length, 3);
  r.unmount();
});

test("breadcrumbs: each item renders a link with data-slot", () => {
  const r = render(() => <Fixture />);
  const items = r.container.querySelectorAll('[data-slot="breadcrumbs-item"]');
  assert.equal(items.length, 3);
  assert.equal(items[0]!.className, "breadcrumbs__item");
  assert.equal(link(r.container, "Home").getAttribute("href"), "#home");
  assert.equal(link(r.container, "Products").getAttribute("href"), "#products");
  assert.match(link(r.container, "Home").className, /breadcrumbs__link/);
  r.unmount();
});

test("breadcrumbs: current page on the last item without separator", () => {
  const r = render(() => <Fixture />);
  const current = link(r.container, "Laptop");
  assert.equal(current.closest("li")!.getAttribute("data-current"), "true");
  assert.equal(current.getAttribute("aria-current"), "page");
  assert.equal(current.closest("li")!.querySelector("[data-slot=breadcrumbs-separator]"), null);
  r.unmount();
});

test("breadcrumbs: default chevron separator between non-final items", () => {
  const r = render(() => <Fixture />);
  const seps = r.container.querySelectorAll('[data-slot="breadcrumbs-separator"]');
  assert.equal(seps.length, 2);
  assert.equal(seps[0]!.tagName.toLowerCase(), "svg");
  assert.equal(seps[0]!.getAttribute("class"), "breadcrumbs__separator");
  r.unmount();
});

test("breadcrumbs: custom separator (node value cloned per item, function called per item)", () => {
  const r = render(() => <Fixture separator={<span data-testid="custom-separator">/</span>} />);
  const seps = r.container.querySelectorAll('[data-slot="breadcrumbs-separator"]');
  assert.equal(seps.length, 2);
  assert.equal(r.container.querySelectorAll("[data-testid=custom-separator]").length, 2);
  assert.equal(seps[0]!.className, "breadcrumbs__separator");
  r.unmount();
  const f = render(() => <Fixture separator={() => <span data-testid="fn-separator">/</span>} />);
  assert.equal(f.container.querySelectorAll("[data-testid=fn-separator]").length, 2);
  f.unmount();
});

test("breadcrumbs: isDisabled → aria-disabled on links", () => {
  const r = render(() => <Fixture isDisabled />);
  assert.equal(link(r.container, "Home").getAttribute("aria-disabled"), "true");
  assert.equal(link(r.container, "Products").getAttribute("aria-disabled"), "true");
  r.unmount();
});

test("breadcrumbs: onPress on a non-current item", async () => {
  let presses = 0;
  const r = render(() => (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#home" onPress={() => presses++}>
        Home
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Current</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  link(r.container, "Home").click();
  await new Promise((res) => setTimeout(res, 10));
  assert.equal(presses, 1);
  r.unmount();
});

test("breadcrumbs: class composes after the slot class on root + item; function children bypass the link", () => {
  const r = render(() => (
    <Breadcrumbs class="gap-4">
      <Breadcrumbs.Item class="x" href="#a">
        A
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>{(() => <b id="fn">B</b>) as never}</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  assert.equal(r.container.querySelector("ol")!.className, "breadcrumbs gap-4");
  assert.equal(r.container.querySelector("li")!.className, "breadcrumbs__item x");
  const last = r.container.querySelectorAll("li")[1]!;
  assert.ok(last.querySelector("#fn"));
  assert.equal(last.querySelector("a, [role=link]"), null);
  r.unmount();
});

test("breadcrumbs (Rivet addition): overflowMode=collapse — overflow item = breadcrumbs__item + separator, text children name the menu items", async () => {
  // happy-dom has no layout: the list is 300px, every item 100px (Spectrum's mocks).
  const proto = (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype;
  const own = Object.getOwnPropertyDescriptor(proto, "offsetWidth");
  Object.defineProperty(proto, "offsetWidth", {
    configurable: true,
    get: function (this: HTMLElement) {
      return this.tagName === "OL" ? 300 : 100;
    },
  });
  // happy-dom's ResizeObserver never reports: one that reports on observe (as a browser does).
  const g = globalThis as unknown as { ResizeObserver: unknown };
  const RO = g.ResizeObserver;
  // A browser always passes the entries (createOverflow reads the measured-axis `contentRect` since 8900fe85).
  g.ResizeObserver = class {
    cb: (entries: { contentRect: { width: number; height: number } }[]) => void;
    constructor(cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {
      this.cb = cb;
    }
    observe() {
      queueMicrotask(() => this.cb([{ contentRect: { width: 300, height: 20 } }]));
    }
    disconnect() {}
  };
  let seen: { key: unknown; textValue: string; href: string | undefined }[] = [];
  const r = render(() => (
    <Breadcrumbs
      overflowMode="collapse"
      renderOverflow={(items) => {
        seen = items;
        return (
          <button type="button" aria-label="More">
            …
          </button>
        );
      }}
    >
      <Breadcrumbs.Item id="home" href="#home">
        Home
      </Breadcrumbs.Item>
      <Breadcrumbs.Item id="docs" href="#docs">
        Docs
      </Breadcrumbs.Item>
      <Breadcrumbs.Item id="ui" href="#ui">
        UI
      </Breadcrumbs.Item>
      <Breadcrumbs.Item id="here">Breadcrumbs</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  try {
    for (let i = 0; i < 5; i++) await new Promise((res) => setTimeout(res, 10));
    const items = [...r.container.querySelectorAll("ol > li")];
    // 300px: overflow item (100) + last (100) fit, a third crumb would make 300 (not < 300).
    assert.equal(items.length, 2);
    assert.equal(items[0]!.className, "breadcrumbs__item");
    assert.equal(items[0]!.getAttribute("data-overflow"), "true");
    assert.ok(items[0]!.querySelector("button[aria-label=More]"));
    assert.ok(items[0]!.querySelector("[data-slot=breadcrumbs-separator]"));
    assert.equal(items[1]!.textContent, "Breadcrumbs");
    assert.deepEqual(
      seen.map((i) => [i.key, i.textValue, i.href]),
      [
        ["home", "Home", "#home"],
        ["docs", "Docs", "#docs"],
        ["ui", "UI", "#ui"],
      ],
    );
  } finally {
    r.unmount();
    g.ResizeObserver = RO;
    if (own) Object.defineProperty(proto, "offsetWidth", own);
    else delete (proto as { offsetWidth?: number }).offsetWidth;
  }
});

test("breadcrumbs: items without a render function (links, disabled entry, current last)", () => {
  const r = render(() => <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Docs", href: "/docs", isDisabled: true }, { label: "Here" }]} />);
  const items = [...r.container.querySelectorAll("li")] as HTMLElement[];
  assert.deepEqual(
    items.map((i) => i.textContent),
    ["Home", "Docs", "Here"],
  );
  assert.equal(items[2]!.getAttribute("data-current"), "true");
  assert.equal(link(r.container, "Home").getAttribute("href"), "/");
  assert.equal(link(r.container, "Docs").getAttribute("aria-disabled"), "true");
  assert.equal(r.container.querySelectorAll("[data-slot=breadcrumbs-separator]").length, 2);
  r.unmount();
});
