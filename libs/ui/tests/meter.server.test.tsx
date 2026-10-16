// Server-target suite: `Meter` SSR markup (upstream tests/components/meter/meter.test.tsx cases that read markup;
// role / accessible-name queries become attribute asserts). Expected classes come from the vendored `meterVariants`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Meter, meterVariants } from "../src/components/meter/index.ts";
import { Label } from "../src/components/label/index.ts";

const tag = (html: string, slot: string): string => html.match(new RegExp(`<[a-z]+ [^>]*data-slot="${slot}"[^>]*>`))?.[0] ?? "";
const attr = (el: string, name: string): string | undefined => el.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

test("meter SSR: meter role, label link, every part's tag / data-slot / class (upstream Default story)", async () => {
  const html = await renderToString(() => (
    <Meter value={60}>
      <Label>Storage</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  ));
  const slots = meterVariants({});
  const root = tag(html, "meter");
  assert.equal(attr(root, "role"), "meter");
  assert.equal(attr(root, "class"), slots.base());
  assert.equal(attr(root, "aria-valuenow"), "60");
  assert.equal(attr(root, "aria-valuetext"), "60%");
  const label = tag(html, "label");
  assert.equal(attr(root, "aria-labelledby"), attr(label, "id"), "accessible name = Label");
  assert.match(html, /<span[^>]*data-slot="meter-output"[^>]*>60%<\/span>/);
  assert.equal(attr(tag(html, "meter-output"), "class"), slots.output());
  assert.ok(tag(html, "meter-track").startsWith("<div"));
  assert.equal(attr(tag(html, "meter-track"), "class"), slots.track());
  const fill = tag(html, "meter-fill");
  assert.ok(fill.startsWith("<div"));
  assert.equal(attr(fill, "class"), slots.fill());
  assert.match(attr(fill, "style") ?? "", /^width: ?60%;?$/);
});

test("meter SSR: color / size BEM modifiers, class + data-* passthrough", async () => {
  for (const color of ["default", "accent", "success", "warning", "danger"] as const)
    for (const size of ["sm", "md", "lg"] as const) {
      const html = await renderToString(() => (
        <Meter aria-label="Loading" color={color} size={size} class="w-64" data-foo="bar" value={50}>
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>
      ));
      const root = tag(html, "meter");
      assert.equal(attr(root, "class"), `${meterVariants({ color, size }).base()} w-64`);
      assert.equal(attr(root, "data-foo"), "bar");
    }
});

test("meter SSR: CustomValue story — formatOptions currency, min / max", async () => {
  const html = await renderToString(() => (
    <Meter formatOptions={{ style: "currency", currency: "USD" }} maxValue={1000} minValue={0} value={750}>
      <Label>Revenue</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  ));
  assert.match(html, /data-slot="meter-output"[^>]*>\$750\.00<\/span>/);
  assert.match(attr(tag(html, "meter-fill"), "style") ?? "", /^width: ?75%;?$/);
});

test("meter SSR: Output children replace the value text; class on parts; parts outside a Meter get only `class`", async () => {
  const html = await renderToString(() => (
    <Meter aria-label="x" value={10}>
      <Meter.Output class="o">custom</Meter.Output>
      <Meter.Track class="t">
        <Meter.Fill class="f" />
      </Meter.Track>
    </Meter>
  ));
  const slots = meterVariants({});
  assert.match(html, /data-slot="meter-output"[^>]*>custom<\/span>/);
  assert.equal(attr(tag(html, "meter-output"), "class"), `${slots.output()} o`);
  assert.equal(attr(tag(html, "meter-track"), "class"), `${slots.track()} t`);
  assert.equal(attr(tag(html, "meter-fill"), "class"), `${slots.fill()} f`);
  const outside = await renderToString(() => <Meter.Track class="t" />);
  assert.equal(attr(tag(outside, "meter-track"), "class"), "t");
});

test("meter SSR: render-prop children get the cdk state (accessors)", async () => {
  const html = await renderToString(() => (
    <Meter aria-label="x" value={30}>
      {({ percentage, valueText }) => <i>{`${percentage()}|${valueText()}`}</i>}
    </Meter>
  ));
  assert.match(html, /<i>30\|30%<\/i>/);
});
