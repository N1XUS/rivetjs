// DOM-target suite (happy-dom): `ProgressCircle` (upstream tests/components/progress-circle/progress-circle.test.tsx ported: role +
// name, data-slot, color modifier, data-* passthrough, sub-part slots) + the ring: `stroke-dashoffset` follows a live `value={v()}`
// and `isIndeterminate={i()}` in place (geometry = upstream constants), context `{ color, size, state }`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { ProgressCircle, progressCircleVariants } = await import("../src/components/progress-circle/index.ts");
const { ProgressCircleContext, CIRCUMFERENCE, RADIUS } = await import("../src/components/progress-circle/progress-circle.tsx");

const ring = () => (
  <ProgressCircle.Track data-testid="track">
    <ProgressCircle.TrackCircle data-testid="track-circle" />
    <ProgressCircle.FillCircle data-testid="fill-circle" />
  </ProgressCircle.Track>
);
const offset = (r: { find: (s: string) => Element | null }) => Number(r.find("[data-slot=progress-circle-fill-circle]")!.getAttribute("stroke-dashoffset"));

test("progress-circle: upstream geometry constants (stroke 4, center 18 → r 16, C = 2πr)", () => {
  assert.equal(RADIUS, 16);
  assert.equal(CIRCUMFERENCE, 2 * Math.PI * 16);
});

test("progress-circle: progressbar role + name; data-slot + BEM block on every part; svg elements", () => {
  const r = render(() => (
    <ProgressCircle aria-label="Loading" data-testid="progress-circle" value={60}>
      {ring()}
    </ProgressCircle>
  ));
  const root = r.find("[role=progressbar]")!;
  assert.equal(root.getAttribute("aria-label"), "Loading");
  assert.equal(root.getAttribute("data-slot"), "progress-circle");
  assert.equal(root.getAttribute("class"), progressCircleVariants({}).base());
  const slots = progressCircleVariants({});
  for (const [id, slot, cls, tag] of [
    ["track", "progress-circle-track", slots.track(), "svg"],
    ["track-circle", "progress-circle-track-circle", slots.trackCircle(), "circle"],
    ["fill-circle", "progress-circle-fill-circle", slots.fillCircle(), "circle"],
  ]) {
    const el = r.find(`[data-testid=${id}]`)!;
    assert.equal(el.getAttribute("data-slot"), slot);
    assert.equal(el.getAttribute("class"), cls);
    assert.equal(el.tagName.toLowerCase(), tag);
  }
  assert.ok(Math.abs(offset(r) - (CIRCUMFERENCE - 0.6 * CIRCUMFERENCE)) < 1e-9);
  r.unmount();
});

test("progress-circle: color modifier + data attribute passthrough", () => {
  const r = render(() => (
    <ProgressCircle aria-label="Loading" color="warning" data-foo="bar" data-testid="progress-circle" value={50}>
      {ring()}
    </ProgressCircle>
  ));
  const root = r.find("[data-testid=progress-circle]")!;
  assert.ok(root.className.includes("progress-circle--warning"));
  assert.equal(root.getAttribute("data-foo"), "bar");
  r.unmount();
});

test("progress-circle: live value moves the ring twice in place; live isIndeterminate → quarter ring and back", () => {
  const v = signal(10);
  const ind = signal(false);
  const r = render(() => (
    <ProgressCircle aria-label="Loading" value={v()} isIndeterminate={ind()}>
      {ring()}
    </ProgressCircle>
  ));
  const fill = r.find("[data-slot=progress-circle-fill-circle]");
  for (const value of [50, 75]) {
    v.set(value);
    assert.ok(Math.abs(offset(r) - (CIRCUMFERENCE - (value / 100) * CIRCUMFERENCE)) < 1e-9, String(value));
  }
  ind.set(true);
  assert.equal(offset(r), CIRCUMFERENCE * 0.75);
  ind.set(false);
  assert.ok(Math.abs(offset(r) - 0.25 * CIRCUMFERENCE) < 1e-9);
  assert.ok(r.find("[data-slot=progress-circle-fill-circle]") === fill, "fill circle kept");
  r.unmount();
});

test("progress-circle: context { color, size, state } inside the root; render-prop children", () => {
  let seen = "";
  const Probe = () => {
    const ctx = useContext(ProgressCircleContext);
    seen = `${ctx.color}|${ctx.size}|${ctx.state?.percentage()}|${ctx.state?.isIndeterminate()}`;
    return <i />;
  };
  const r = render(() => (
    <ProgressCircle aria-label="x" value={20} color="danger" size="lg">
      <Probe />
    </ProgressCircle>
  ));
  assert.equal(seen, "danger|lg|20|false");
  r.unmount();
  const r2 = render(() => (
    <ProgressCircle aria-label="x" value={5}>
      {({ valueText }) => <b>{valueText()}</b>}
    </ProgressCircle>
  ));
  assert.equal(r2.find("b")!.textContent, "5%");
  r2.unmount();
});
