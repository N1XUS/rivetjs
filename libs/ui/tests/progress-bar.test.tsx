// DOM-target suite (happy-dom): `ProgressBar` (upstream tests/components/progress-bar/progress-bar.test.tsx ported: role + name,
// data-slot, color modifier, data-* passthrough, indeterminate, sub-part slots) + live props: `value={v()}` / `isIndeterminate={i()}`
// / `color={c()}` update the fill width, output text and classes in place (same nodes), context `{ color, size, state }`, ref.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { ProgressBar, progressBarVariants } = await import("../src/components/progress-bar/index.ts");
const { ProgressBarContext } = await import("../src/components/progress-bar/progress-bar.tsx");
const { Label } = await import("../src/components/label/index.ts");

const bar = () => (
  <ProgressBar.Track>
    <ProgressBar.Fill />
  </ProgressBar.Track>
);

test("progress-bar: progressbar role named by the Label; data-slot + BEM block on every part", () => {
  const r = render(() => (
    <ProgressBar value={60}>
      <Label>Loading</Label>
      <ProgressBar.Output data-testid="output" />
      <ProgressBar.Track data-testid="track">
        <ProgressBar.Fill data-testid="fill" />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  const root = r.find("[role=progressbar]")!;
  const label = r.find("[data-slot=label]")!;
  assert.equal(root.getAttribute("aria-labelledby"), label.id);
  assert.equal(label.textContent, "Loading");
  assert.equal(root.getAttribute("data-slot"), "progress-bar");
  assert.equal(root.getAttribute("class"), progressBarVariants({}).base());
  const slots = progressBarVariants({});
  for (const [id, slot, cls] of [
    ["output", "progress-bar-output", slots.output()],
    ["track", "progress-bar-track", slots.track()],
    ["fill", "progress-bar-fill", slots.fill()],
  ]) {
    const el = r.find(`[data-testid=${id}]`)!;
    assert.equal(el.getAttribute("data-slot"), slot);
    assert.equal(el.getAttribute("class"), cls);
  }
  assert.equal(r.find("[data-testid=output]")!.textContent, "60%");
  assert.equal((r.find("[data-testid=fill]") as HTMLElement).style.width, "60%");
  r.unmount();
});

test("progress-bar: color modifier + data attribute passthrough", () => {
  const r = render(() => (
    <ProgressBar aria-label="Loading" color="success" data-foo="bar" data-testid="progress-bar" value={50}>
      {bar()}
    </ProgressBar>
  ));
  const root = r.find("[data-testid=progress-bar]")!;
  assert.ok(root.className.includes("progress-bar--success"));
  assert.equal(root.getAttribute("data-foo"), "bar");
  r.unmount();
});

test("progress-bar: indeterminate → no aria-valuenow, no fill width", () => {
  const r = render(() => (
    <ProgressBar isIndeterminate aria-label="Loading">
      {bar()}
    </ProgressBar>
  ));
  assert.equal(r.find("[role=progressbar]")!.hasAttribute("aria-valuenow"), false);
  assert.equal((r.find("[data-slot=progress-bar-fill]") as HTMLElement).style.width, "");
  r.unmount();
});

test("progress-bar: live value — fill width + output follow two changes, nodes kept", () => {
  const v = signal(10);
  const r = render(() => (
    <ProgressBar aria-label="Loading" value={v()}>
      <ProgressBar.Output />
      {bar()}
    </ProgressBar>
  ));
  const nodes = ["[role=progressbar]", "[data-slot=progress-bar-output]", "[data-slot=progress-bar-fill]"].map((s) => r.find(s));
  for (const value of [40, 85]) {
    v.set(value);
    assert.equal((r.find("[data-slot=progress-bar-fill]") as HTMLElement).style.width, `${value}%`);
    assert.equal(r.find("[data-slot=progress-bar-output]")!.textContent, `${value}%`);
    assert.equal(r.find("[role=progressbar]")!.getAttribute("aria-valuenow"), String(value));
  }
  ["[role=progressbar]", "[data-slot=progress-bar-output]", "[data-slot=progress-bar-fill]"].forEach((s, i) => assert.ok(r.find(s) === nodes[i], `${s} kept`));
  r.unmount();
});

test("progress-bar: live isIndeterminate toggles the width and aria-valuenow both ways", () => {
  const ind = signal(false);
  const r = render(() => (
    <ProgressBar aria-label="Loading" value={30} isIndeterminate={ind()}>
      {bar()}
    </ProgressBar>
  ));
  const fill = r.find("[data-slot=progress-bar-fill]") as HTMLElement;
  ind.set(true);
  assert.equal(fill.style.width, "");
  assert.equal(r.find("[role=progressbar]")!.hasAttribute("aria-valuenow"), false);
  ind.set(false);
  assert.equal(fill.style.width, "30%");
  assert.equal(r.find("[role=progressbar]")!.getAttribute("aria-valuenow"), "30");
  r.unmount();
});

test("progress-bar: live color / size / class update the root classes in place", () => {
  const color = signal<"accent" | "danger">("accent");
  const size = signal<"sm" | "lg">("sm");
  const cls = signal("a");
  const r = render(() => (
    <ProgressBar aria-label="x" value={1} color={color()} size={size()} class={cls()}>
      {bar()}
    </ProgressBar>
  ));
  const root = r.find("[role=progressbar]")!;
  color.set("danger");
  size.set("lg");
  cls.set("b");
  assert.equal(root.getAttribute("class"), `${progressBarVariants({ color: "danger", size: "lg" }).base()} b`);
  assert.ok(r.find("[role=progressbar]") === root);
  r.unmount();
});

test("progress-bar: context { color, size, state } inside the root (state = cdk accessors); render-prop children", () => {
  const seen: string[] = [];
  const Probe = () => {
    const ctx = useContext(ProgressBarContext);
    seen.push(`${ctx.color}|${ctx.size}|${ctx.state?.percentage()}|${ctx.state?.valueText()}|${ctx.state?.isIndeterminate()}`);
    return <i />;
  };
  const r = render(() => (
    <ProgressBar aria-label="x" value={25} color="warning" size="lg">
      <Probe />
      {/* not a render prop: plain children */}
    </ProgressBar>
  ));
  assert.deepEqual(seen, ["warning|lg|25|25%|false"]);
  r.unmount();
  const r2 = render(() => (
    <ProgressBar aria-label="x" value={70}>
      {({ percentage, valueText }) => <b>{`${percentage()}|${valueText()}`}</b>}
    </ProgressBar>
  ));
  assert.equal(r2.find("b")!.textContent, "70|70%");
  r2.unmount();
});

test("progress-bar: ref on root (cdk) and on parts (dom.*)", () => {
  let root: Element | undefined;
  let fill: Element | undefined;
  const r = render(() => (
    <ProgressBar aria-label="x" value={1} ref={(el: HTMLDivElement) => (root = el)}>
      <ProgressBar.Track>
        <ProgressBar.Fill ref={(el: Element) => (fill = el)} />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  assert.equal(root?.getAttribute("role"), "progressbar");
  assert.equal(fill?.getAttribute("data-slot"), "progress-bar-fill");
  r.unmount();
});
