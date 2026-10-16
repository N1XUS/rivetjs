// DOM-target suite: `Badge` (upstream badge tests ported): anchor, label wrapping, placement / size / variant / color classes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Badge, BadgeRoot, BadgeLabel, BadgeAnchor, badgeVariants } = await import("../src/components/badge/index.ts");

test("badge: anchor + badge, string child wrapped in badge__label", () => {
  const r = render(() => (
    <Badge.Anchor>
      <img alt="" />
      <Badge color="danger" placement="bottom-left" size="sm" variant="soft">
        5
      </Badge>
    </Badge.Anchor>
  ));
  const anchor = r.container.firstElementChild!;
  assert.equal(anchor.className, "badge-anchor");
  assert.equal(anchor.getAttribute("data-slot"), "badge-anchor");
  const badge = anchor.querySelector("[data-slot=badge]")!;
  assert.equal(badge.className, badgeVariants({ color: "danger", placement: "bottom-left", size: "sm", variant: "soft" }).base());
  for (const c of ["badge--danger", "badge--bottom-left", "badge--sm", "badge--soft"]) assert.match(badge.className, new RegExp(c));
  const label = badge.querySelector(".badge__label")!;
  assert.equal(label.textContent, "5");
  assert.equal(label.getAttribute("data-slot"), "badge-label");
  r.unmount();
});

test("badge: defaults; empty badge (dot) has no label; element children not wrapped; label outside a badge", () => {
  const r = render(() => <Badge />);
  assert.equal(r.container.firstElementChild?.className, badgeVariants().base());
  assert.match(r.container.firstElementChild!.className, /badge--default.*badge--top-right|badge--top-right.*badge--default|badge--md/);
  assert.equal(r.container.querySelector(".badge__label"), null);
  r.unmount();
  const e = render(() => (
    <Badge>
      <b>b</b>
    </Badge>
  ));
  assert.equal(e.container.querySelector(".badge__label"), null);
  e.unmount();
  const o = render(() => <BadgeLabel class="solo">s</BadgeLabel>);
  assert.equal(o.container.firstElementChild?.className, "solo");
  o.unmount();
  assert.equal(Badge, BadgeRoot);
  assert.equal(Badge.Anchor, BadgeAnchor);
});

test("badge: hard-coded defaults equal badgeVariants defaultVariants (re-vendor drift guard)", () => {
  const r = render(() => (
    <Badge.Anchor>
      <Badge>1</Badge>
    </Badge.Anchor>
  ));
  const badge = r.container.querySelector("[data-slot=badge]")!;
  assert.equal(badge.className, badgeVariants().base());
  assert.equal(badge.querySelector("[data-slot=badge-label]")?.className, badgeVariants().label());
  r.unmount();
});
