// Server-target suite: `ProgressBar` SSR markup (upstream tests/components/progress-bar/progress-bar.test.tsx cases that read markup;
// role / accessible-name queries become attribute asserts). Expected classes come from the vendored `progressBarVariants`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ProgressBar, progressBarVariants } from "../src/components/progress-bar/index.ts";
import { Label } from "../src/components/label/index.ts";

const tag = (html: string, slot: string): string => html.match(new RegExp(`<[a-z]+ [^>]*data-slot="${slot}"[^>]*>`))?.[0] ?? "";
const attr = (el: string, name: string): string | undefined => el.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

test("progress-bar SSR: progressbar role, label link, every part's tag / data-slot / class (upstream Default story)", async () => {
  const html = await renderToString(() => (
    <ProgressBar value={60}>
      <Label>Loading</Label>
      <ProgressBar.Output />
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  const slots = progressBarVariants({});
  const root = tag(html, "progress-bar");
  assert.equal(attr(root, "role"), "progressbar");
  assert.equal(attr(root, "class"), slots.base());
  assert.equal(attr(root, "aria-valuenow"), "60");
  assert.equal(attr(root, "aria-valuetext"), "60%");
  const label = tag(html, "label");
  assert.equal(attr(root, "aria-labelledby"), attr(label, "id"), "accessible name = Label");
  assert.match(html, /<span[^>]*data-slot="progress-bar-output"[^>]*>60%<\/span>/);
  assert.equal(attr(tag(html, "progress-bar-output"), "class"), slots.output());
  assert.ok(tag(html, "progress-bar-track").startsWith("<div"));
  assert.equal(attr(tag(html, "progress-bar-track"), "class"), slots.track());
  const fill = tag(html, "progress-bar-fill");
  assert.ok(fill.startsWith("<div"));
  assert.equal(attr(fill, "class"), slots.fill());
  assert.match(attr(fill, "style") ?? "", /^width: ?60%;?$/);
});

test("progress-bar SSR: color / size BEM modifiers, class + data-* passthrough", async () => {
  for (const color of ["default", "accent", "success", "warning", "danger"] as const)
    for (const size of ["sm", "md", "lg"] as const) {
      const html = await renderToString(() => (
        <ProgressBar aria-label="Loading" color={color} size={size} class="w-64" data-foo="bar" value={50}>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ));
      const root = tag(html, "progress-bar");
      assert.equal(attr(root, "class"), `${progressBarVariants({ color, size }).base()} w-64`);
      assert.equal(attr(root, "data-foo"), "bar");
    }
});

test("progress-bar SSR: indeterminate → no aria-valuenow, no fill width", async () => {
  const html = await renderToString(() => (
    <ProgressBar isIndeterminate aria-label="Loading">
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  assert.equal(attr(tag(html, "progress-bar"), "aria-valuenow"), undefined);
  assert.equal(attr(tag(html, "progress-bar-fill"), "style"), undefined);
});

test("progress-bar SSR: CustomValue story — formatOptions currency, min / max", async () => {
  const html = await renderToString(() => (
    <ProgressBar formatOptions={{ style: "currency", currency: "USD" }} maxValue={1000} minValue={0} value={750}>
      <Label>Revenue</Label>
      <ProgressBar.Output />
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  assert.match(html, /data-slot="progress-bar-output"[^>]*>\$750\.00<\/span>/);
  assert.match(attr(tag(html, "progress-bar-fill"), "style") ?? "", /^width: ?75%;?$/);
});

test("progress-bar SSR: Output children replace the value text; class on parts; parts outside a ProgressBar get only `class`", async () => {
  const html = await renderToString(() => (
    <ProgressBar aria-label="x" value={10}>
      <ProgressBar.Output class="o">custom</ProgressBar.Output>
      <ProgressBar.Track class="t">
        <ProgressBar.Fill class="f" />
      </ProgressBar.Track>
    </ProgressBar>
  ));
  const slots = progressBarVariants({});
  assert.match(html, /data-slot="progress-bar-output"[^>]*>custom<\/span>/);
  assert.equal(attr(tag(html, "progress-bar-output"), "class"), `${slots.output()} o`);
  assert.equal(attr(tag(html, "progress-bar-track"), "class"), `${slots.track()} t`);
  assert.equal(attr(tag(html, "progress-bar-fill"), "class"), `${slots.fill()} f`);
  const outside = await renderToString(() => <ProgressBar.Track class="t" />);
  assert.equal(attr(tag(outside, "progress-bar-track"), "class"), "t");
});

test("progress-bar SSR: render-prop children get the cdk state (accessors)", async () => {
  const html = await renderToString(() => (
    <ProgressBar aria-label="x" value={30}>
      {({ percentage, valueText }) => <i>{`${percentage()}|${valueText()}`}</i>}
    </ProgressBar>
  ));
  assert.match(html, /<i>30\|30%<\/i>/);
});
