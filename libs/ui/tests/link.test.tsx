// DOM-target suite: `Link` (upstream link tests ported): anchor, classes, LinkContext → Link.Icon, default icon, render prop.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Link, LinkRoot, LinkIcon, linkVariants } = await import("../src/components/link/index.ts");

test("link: anchor with class + data-slot", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Link href="/docs" class="font-bold" ref={(e: Element) => (el = e)}>
      Docs
    </Link>
  ));
  const a = r.container.firstElementChild!;
  assert.equal(a, el);
  assert.equal(a.tagName, "A");
  assert.equal(a.getAttribute("href"), "/docs");
  assert.equal(a.getAttribute("data-slot"), "link");
  assert.equal(a.className, "link font-bold");
  assert.equal(a.textContent, "Docs");
  r.unmount();
  assert.equal(Link, LinkRoot);
  assert.equal(Link.Icon, LinkIcon);
  assert.equal(linkVariants().base(), "link");
});

test("link: Link.Icon inside a Link reads the context (link__icon), default lucide icon + data-default-icon", () => {
  const r = render(() => (
    <Link href="/x">
      Go <Link.Icon />
    </Link>
  ));
  const icon = r.container.querySelector("[data-slot=link-icon]")!;
  assert.equal(icon.className, "link__icon");
  assert.equal(icon.getAttribute("data-default-icon"), "true");
  assert.ok(icon.querySelector("svg[data-slot=link-default-icon]"));
  r.unmount();
});

test("link: custom Link.Icon children, class; outside a Link only the class", () => {
  const r = render(() => (
    <Link href="/x">
      <Link.Icon class="i">
        <em>!</em>
      </Link.Icon>
    </Link>
  ));
  const icon = r.container.querySelector("[data-slot=link-icon]")!;
  assert.equal(icon.className, "link__icon i");
  assert.equal(icon.hasAttribute("data-default-icon"), false);
  assert.equal(icon.querySelector("svg"), null);
  r.unmount();
  const o = render(() => <LinkIcon class="solo" />);
  assert.equal(o.container.firstElementChild?.className, "solo");
  o.unmount();
});

test("link: function class composes with the base; render prop swaps the element", () => {
  const r = render(() => (
    <Link href="/x" class={({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hov" : "no")}>
      a
    </Link>
  ));
  assert.equal(r.container.firstElementChild?.className, "link no");
  r.unmount();
  const p = render(() => (
    <Link href="/x" render={(props) => <span {...(props as {})} />}>
      s
    </Link>
  ));
  assert.equal(p.container.firstElementChild?.getAttribute("data-slot"), "link");
  p.unmount();
});
