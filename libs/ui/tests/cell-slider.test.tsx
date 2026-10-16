// DOM-target suite: `CellSlider` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// on happy-dom: compound statics + variants, the range input drives a two-way value signal + onChange and the output, a signal
// write moves the fill, live variant. Pointer drag / keyboard / snap run in Chromium (tests-components `pro-forms.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const mod = await import("../src/components/cell-slider/index.ts");
const { CellSlider, CellSliderRoot, CellSliderLabel, CellSliderOutput, CellSliderTrack, CellSliderFill, CellSliderThumb, cellSliderVariants } = mod;

const flush = () => new Promise((r) => setTimeout(r, 0));

test("cell-slider: compound statics + variants", () => {
  assert.equal(CellSlider, CellSliderRoot);
  assert.equal(CellSlider.Root, CellSliderRoot);
  assert.equal(CellSlider.Label, CellSliderLabel);
  assert.equal(CellSlider.Output, CellSliderOutput);
  assert.equal(CellSlider.Track, CellSliderTrack);
  assert.equal(CellSlider.Fill, CellSliderFill);
  assert.equal(CellSlider.Thumb, CellSliderThumb);
  assert.equal(cellSliderVariants().base(), "cell-slider cell-slider--default");
  assert.equal(cellSliderVariants({ variant: "secondary" }).base(), "cell-slider cell-slider--secondary");
});

test("cell-slider: input change updates the signal + output; a signal write moves the fill", async () => {
  const value = signal(20);
  const calls: number[] = [];
  const r = render(() => (
    <CellSlider value={value} onChange={(v: number) => calls.push(v)}>
      <CellSlider.Track>
        <CellSlider.Fill />
        <CellSlider.Thumb />
      </CellSlider.Track>
      <CellSlider.Label>Brightness</CellSlider.Label>
      <CellSlider.Output />
    </CellSlider>
  ));
  const input = r.container.querySelector<HTMLInputElement>("input[type=range]")!;
  const output = r.container.querySelector("output")!;
  const fill = r.container.querySelector<HTMLElement>("[data-slot=cell-slider-fill]")!;
  assert.equal(output.textContent, "20");
  input.value = "65";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  assert.equal(value(), 65);
  assert.deepEqual(calls, [65]);
  assert.equal(output.textContent, "65");
  value.set(80);
  await flush();
  assert.match(fill.getAttribute("style") ?? "", /width: 80%/);
  r.unmount();
});

test("cell-slider: live variant restyles in place", async () => {
  const variant = signal<"default" | "secondary">("default");
  const r = render(() => (
    <CellSlider aria-label="V" defaultValue={1} variant={variant()}>
      <CellSlider.Track>
        <CellSlider.Thumb />
      </CellSlider.Track>
    </CellSlider>
  ));
  const root = r.container.querySelector("[data-slot=cell-slider]")!;
  assert.match(root.className, /--default/);
  variant.set("secondary");
  await flush();
  assert.match(root.className, /--secondary/);
  r.unmount();
});

test("cell-slider: shorthand — label names the input, input drives the Signal + output", async () => {
  const value = signal(20);
  const r = render(() => <CellSlider value={value} label="Brightness" />);
  const input = r.container.querySelector<HTMLInputElement>("input[type=range]")!;
  const label = r.container.querySelector("[data-slot=cell-slider-label]")!;
  assert.equal(label.textContent, "Brightness");
  assert.ok((input.getAttribute("aria-labelledby") ?? "").includes(label.id));
  input.value = "65";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  assert.equal(value(), 65);
  assert.equal(r.container.querySelector("output")!.textContent, "65");
  r.unmount();
});
