// DOM-target suite: `Alert` (upstream alert tests ported): parts, status classes through context, default indicator icon per
// status (lucide), SurfaceContext.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { useContext } = await import("@rivetjs/reactivity");
const { Alert, AlertRoot, AlertTitle, alertVariants } = await import("../src/components/alert/index.ts");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

test("alert: parts markup + slot classes through context", () => {
  const r = render(() => (
    <Alert status="danger" class="w-full">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>T</Alert.Title>
        <Alert.Description>D</Alert.Description>
      </Alert.Content>
    </Alert>
  ));
  const root = r.container.firstElementChild!;
  assert.equal(root.getAttribute("data-slot"), "alert-root");
  assert.equal(root.className, alertVariants({ status: "danger" }).base({ class: "w-full" }));
  assert.match(root.className, /alert--danger/);
  assert.equal(r.container.querySelector("[data-slot=alert-indicator]")?.className, "alert__indicator");
  assert.equal(r.container.querySelector("[data-slot=alert-content]")?.className, "alert__content");
  const title = r.container.querySelector("[data-slot=alert-title]")!;
  assert.equal(title.tagName, "P");
  assert.equal(title.className, "alert__title");
  const desc = r.container.querySelector("[data-slot=alert-description]")!;
  assert.equal(desc.tagName, "SPAN");
  assert.equal(desc.className, "alert__description");
  r.unmount();
});

test("alert: default indicator icon is a lucide svg per status; custom children replace it", () => {
  const seen = new Set<string>();
  for (const status of ["default", "accent", "success", "warning", "danger"] as const) {
    const r = render(() => (
      <Alert status={status}>
        <Alert.Indicator />
      </Alert>
    ));
    const svg = r.container.querySelector("svg[data-slot=alert-default-icon]")!;
    assert.ok(svg, status);
    assert.equal(svg.getAttribute("width"), "16");
    seen.add(svg.innerHTML);
    r.unmount();
  }
  // default + accent share Info; success / warning / danger differ
  assert.equal(seen.size, 4);
  const c = render(() => (
    <Alert>
      <Alert.Indicator>
        <i>!</i>
      </Alert.Indicator>
    </Alert>
  ));
  assert.equal(c.container.querySelector("svg"), null);
  assert.equal(c.container.querySelector("i")?.textContent, "!");
  c.unmount();
});

test("alert: provides SurfaceContext default; parts outside an Alert get only their class; exports", () => {
  const Probe = () => <u>{useContext(SurfaceContext).variant ?? "none"}</u>;
  const r = render(() => (
    <Alert>
      <Probe />
    </Alert>
  ));
  assert.equal(r.container.querySelector("u")?.textContent, "default");
  r.unmount();
  const o = render(() => <AlertTitle class="solo">t</AlertTitle>);
  assert.equal(o.container.firstElementChild?.className, "solo");
  o.unmount();
  assert.equal(Alert, AlertRoot);
  assert.equal(Alert.Title, AlertTitle);
});

test("alert: hard-coded default status equals alertVariants defaultVariants (re-vendor drift guard)", () => {
  const r = render(() => (
    <Alert>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>T</Alert.Title>
      </Alert.Content>
    </Alert>
  ));
  const s = alertVariants();
  assert.equal(r.container.querySelector("[data-slot=alert-root]")?.className, s.base());
  assert.equal(r.container.querySelector("[data-slot=alert-indicator]")?.className, s.indicator());
  assert.equal(r.container.querySelector("[data-slot=alert-title]")?.className, s.title());
  r.unmount();
});
