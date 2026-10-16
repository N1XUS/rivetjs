// DOM-target suite (happy-dom): `Meter` (upstream tests/components/meter/meter.test.tsx ported: role + name, data-slot, color modifier,
// data-* passthrough, sub-part slots, formatted value text) + `valueText` formats (valueLabel, formatOptions) and live `value={v()}`
// (fill width + output follow, same nodes), context `{ color, size, state }`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Meter, meterVariants } = await import("../src/components/meter/index.ts");
const { MeterContext } = await import("../src/components/meter/meter.tsx");
const { Label } = await import("../src/components/label/index.ts");

test("meter: meter role named by the Label; data-slot + BEM block; output = formatted value", () => {
  const r = render(() => (
    <Meter value={60}>
      <Label>Storage</Label>
      <Meter.Output data-testid="output" />
      <Meter.Track data-testid="track">
        <Meter.Fill data-testid="fill" />
      </Meter.Track>
    </Meter>
  ));
  const root = r.find("[role=meter]")!;
  assert.equal(root.getAttribute("aria-labelledby"), r.find("[data-slot=label]")!.id);
  assert.equal(root.getAttribute("data-slot"), "meter");
  assert.equal(root.getAttribute("class"), meterVariants({}).base());
  const slots = meterVariants({});
  for (const [id, slot, cls] of [
    ["output", "meter-output", slots.output()],
    ["track", "meter-track", slots.track()],
    ["fill", "meter-fill", slots.fill()],
  ]) {
    assert.equal(r.find(`[data-testid=${id}]`)!.getAttribute("data-slot"), slot);
    assert.equal(r.find(`[data-testid=${id}]`)!.getAttribute("class"), cls);
  }
  assert.equal(r.find("[data-testid=output]")!.textContent, "60%");
  assert.equal((r.find("[data-testid=fill]") as HTMLElement).style.width, "60%");
  r.unmount();
});

test("meter: color modifier + data attribute passthrough", () => {
  const r = render(() => (
    <Meter aria-label="Storage" color="danger" data-foo="bar" data-testid="meter" value={50}>
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  ));
  const root = r.find("[data-testid=meter]")!;
  assert.ok(root.className.includes("meter--danger"));
  assert.equal(root.getAttribute("data-foo"), "bar");
  r.unmount();
});

test("meter: valueText formats — valueLabel, currency formatOptions, min / max", () => {
  const r = render(() => (
    <div>
      <Meter id="m1" aria-label="a" value={3} maxValue={4} valueLabel="3 of 4">
        <Meter.Output />
      </Meter>
      <Meter id="m2" aria-label="b" formatOptions={{ style: "currency", currency: "USD" }} minValue={0} maxValue={1000} value={750}>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  ));
  assert.equal(r.find("#m1 [data-slot=meter-output]")!.textContent, "3 of 4");
  assert.equal(r.find("#m1")!.getAttribute("aria-valuetext"), "3 of 4");
  assert.equal(r.find("#m2 [data-slot=meter-output]")!.textContent, "$750.00");
  assert.equal((r.find("#m2 [data-slot=meter-fill]") as HTMLElement).style.width, "75%");
  r.unmount();
});

test("meter: live value — fill width + output follow two changes, nodes kept; live color", () => {
  const v = signal(20);
  const color = signal<"accent" | "warning">("accent");
  const r = render(() => (
    <Meter aria-label="m" value={v()} color={color()}>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  ));
  const fill = r.find("[data-slot=meter-fill]") as HTMLElement;
  const output = r.find("[data-slot=meter-output]")!;
  for (const value of [50, 75]) {
    v.set(value);
    assert.equal(fill.style.width, `${value}%`);
    assert.equal(output.textContent, `${value}%`);
  }
  assert.ok(r.find("[data-slot=meter-fill]") === fill && r.find("[data-slot=meter-output]") === output, "nodes kept");
  color.set("warning");
  assert.equal(r.find("[role=meter]")!.getAttribute("class"), meterVariants({ color: "warning" }).base());
  r.unmount();
});

test("meter: context { color, size, state } inside the root; parts outside a Meter get only `class`", () => {
  let seen = "";
  const Probe = () => {
    const ctx = useContext(MeterContext);
    seen = `${ctx.color}|${ctx.size}|${ctx.state?.percentage()}|${ctx.state?.valueText()}`;
    return <i />;
  };
  const r = render(() => (
    <div>
      <Meter aria-label="m" value={40} color="success" size="sm">
        <Probe />
      </Meter>
      <Meter.Track id="outside" class="t" />
    </div>
  ));
  assert.equal(seen, "success|sm|40|40%");
  assert.equal(r.find("#outside")!.getAttribute("class"), "t");
  r.unmount();
});
