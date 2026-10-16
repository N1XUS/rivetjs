// DOM-target suite: `Slider` (upstream slider tests ported). Keys = `keydown` on the thumb input (upstream user-event keyboard);
// pointer drags, the free drag + Motion1D snap-on-release and focus-visible via Tab run in Chromium (`tests-components/slider.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Slider, SliderRoot, SliderOutput, SliderTrack, SliderFill, SliderThumb, SliderMarks, sliderVariants } =
  await import("../src/components/slider/index.ts");
const { Label } = await import("../src/components/label/index.ts");

const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement;
const qa = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as HTMLElement[];
const thumbs = (root: ParentNode) => qa(root, "input[type=range]") as HTMLInputElement[];
const key = async (el: HTMLElement, k: string) => {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
  await flush();
};
/** Accessible name via `aria-labelledby` (the composed Label). */
const nameOf = (root: ParentNode, el: HTMLElement) =>
  (el.getAttribute("aria-labelledby") ?? "")
    .split(" ")
    .map((id) => root.querySelector(`[id="${id}"]`)?.textContent ?? "")
    .join(" ")
    .trim();

type Props = Record<string, unknown>;
const renderSlider = (props: Props = {}) =>
  render(() => (
    <Slider data-testid="slider" defaultValue={30} {...(props as {})}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;

const renderRangeSlider = (props: Props = {}) =>
  render(() => (
    <Slider data-testid="slider" defaultValue={[100, 500]} maxValue={1000} minValue={0} step={50} {...(props as {})}>
      <Label>Price Range</Label>
      <Slider.Output />
      <Slider.Track>
        {({ state }) => (
          <>
            <Slider.Fill />
            {state.defaultValues.map((_, i) => (
              <Slider.Thumb index={i} />
            ))}
          </>
        )}
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;

/* ------------------------------------------------------------------ index */

test("index: compound parts, named exports, variants", () => {
  assert.equal(Slider, SliderRoot);
  assert.equal(Slider.Root, SliderRoot);
  assert.equal(Slider.Output, SliderOutput);
  assert.equal(Slider.Track, SliderTrack);
  assert.equal(Slider.Fill, SliderFill);
  assert.equal(Slider.Thumb, SliderThumb);
  assert.equal(Slider.Marks, SliderMarks);
  assert.equal(typeof sliderVariants, "function");
});

/* ------------------------------------------------------------------ upstream slider.test.tsx */

test("upstream: renders a slider thumb with accessible name from composed Label", () => {
  const root = renderSlider();
  const [thumb] = thumbs(root);
  assert.ok(thumb);
  assert.equal(nameOf(root, thumb!), "Volume");
});

test("upstream: exposes data-slots and BEM block", () => {
  const root = renderSlider();
  const slider = q(root, "[data-testid=slider]");
  assert.equal(slider.getAttribute("data-slot"), "slider");
  assert.ok(slider.className.includes("slider"));
  for (const s of ["slider-track", "slider-fill", "slider-thumb", "slider-output"]) assert.ok(q(root, `[data-slot="${s}"]`), s);
  const slots = sliderVariants({});
  assert.ok(q(root, "[data-slot=slider-track]").classList.contains(slots.track()));
  assert.ok(q(root, "[data-slot=slider-fill]").classList.contains(slots.fill()));
  assert.ok(q(root, "[data-slot=slider-thumb]").classList.contains(slots.thumb()));
  assert.ok(q(root, "[data-slot=slider-output]").classList.contains(slots.output()));
});

test("upstream: exposes default value via range input and output text", () => {
  const root = renderSlider({ defaultValue: 30 });
  assert.equal(thumbs(root)[0]!.value, "30");
  assert.equal(q(root, "[data-slot=slider-output]").textContent, "30");
});

test("upstream: calls onChange when value is incremented or decremented", async () => {
  const calls: unknown[] = [];
  const root = renderSlider({ defaultValue: 30, onChange: (v: unknown) => calls.push(v) });
  const thumb = thumbs(root)[0]!;
  await key(thumb, "ArrowRight");
  assert.equal(calls.at(-1), 31);
  assert.equal(thumb.value, "31");
  await key(thumb, "ArrowLeft");
  assert.equal(calls.at(-1), 30);
  assert.equal(thumb.value, "30");
});

test("upstream: supports Home / End keys to jump to min / max", async () => {
  const calls: unknown[] = [];
  const root = renderSlider({ defaultValue: 30, onChange: (v: unknown) => calls.push(v) });
  const thumb = thumbs(root)[0]!;
  await key(thumb, "End");
  assert.equal(calls.at(-1), 100);
  await key(thumb, "Home");
  assert.equal(calls.at(-1), 0);
});

test("upstream: calls onChangeEnd when the interaction completes", async () => {
  const ends: unknown[] = [];
  const root = renderSlider({ defaultValue: 30, onChangeEnd: (v: unknown) => ends.push(v) });
  await key(thumbs(root)[0]!, "ArrowRight");
  assert.deepEqual(ends, [31]);
});

test("upstream: supports controlled value (Rivet: a two-way signal; the output follows)", async () => {
  const value = signal(40);
  const root = render(() => (
    <Slider data-testid="slider" value={value}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  const thumb = thumbs(root)[0]!;
  assert.equal(thumb.value, "40");
  value.set(60);
  await flush();
  assert.equal(thumb.value, "60");
  assert.equal(q(root, "[data-slot=slider-output]").textContent, "60");
  assert.equal(q(root, "[data-slot=slider-fill]").style.width, "60%");
  await key(thumb, "ArrowRight");
  assert.equal(value(), 61);
});

test("upstream: supports disabled state and blocks keyboard interaction", async () => {
  const calls: unknown[] = [];
  const root = renderSlider({ defaultValue: 30, isDisabled: true, onChange: (v: unknown) => calls.push(v) });
  assert.equal(q(root, "[data-slot=slider-track]").getAttribute("data-disabled"), "true");
  assert.equal(q(root, "[data-slot=slider-fill]").getAttribute("data-disabled"), "true");
  assert.equal(q(root, "[data-slot=slider]").getAttribute("data-disabled"), "true");
  await key(thumbs(root)[0]!, "ArrowRight");
  assert.deepEqual(calls, []);
});

test("upstream: supports vertical orientation via data-orientation", () => {
  const root = renderSlider({ orientation: "vertical" });
  assert.equal(q(root, "[data-testid=slider]").getAttribute("data-orientation"), "vertical");
  const fill = q(root, "[data-slot=slider-fill]");
  assert.equal(fill.style.bottom, "0%");
  assert.equal(fill.style.height, "30%");
});

test("default orientation is horizontal (upstream default prop)", () => {
  const root = renderSlider();
  assert.equal(q(root, "[data-testid=slider]").getAttribute("data-orientation"), "horizontal");
});

test("upstream range: renders two thumbs with independent values", () => {
  const root = renderRangeSlider();
  const [a, b] = thumbs(root);
  assert.equal(thumbs(root).length, 2);
  assert.equal(a!.value, "100");
  assert.equal(b!.value, "500");
});

test("upstream range: supports moving the focused thumb via arrow keys", async () => {
  const calls: unknown[] = [];
  const root = renderRangeSlider({ onChange: (v: unknown) => calls.push(v) });
  const [a, b] = thumbs(root);
  await key(a!, "ArrowRight");
  assert.deepEqual(calls.at(-1), [150, 500]);
  assert.equal(a!.value, "150");
  assert.equal(b!.value, "500");
  await key(b!, "ArrowLeft");
  assert.deepEqual(calls.at(-1), [150, 450]);
});

test("upstream range: exposes track fill-start and fill-end data attributes", () => {
  const root = renderRangeSlider();
  const track = q(root, "[data-slot=slider-track]");
  assert.notEqual(track.getAttribute("data-fill-start"), "true");
  assert.notEqual(track.getAttribute("data-fill-end"), "true");
});

/* ------------------------------------------------------------------ Rivet */

test("output: thumb labels joined with an en dash (upstream default children)", () => {
  const root = renderRangeSlider({ formatOptions: { style: "currency", currency: "USD", maximumFractionDigits: 0 } });
  assert.equal(q(root, "[data-slot=slider-output]").textContent, "$100 – $500");
});

test("output: function children get the render props; plain children replace the default", () => {
  const root = render(() => (
    <Slider defaultValue={[25, 75]}>
      <Slider.Output>{({ state }) => `${state.defaultValues.length} thumbs`}</Slider.Output>
      <Slider.Track>
        <Slider.Thumb index={0} aria-label="a" />
        <Slider.Thumb index={1} aria-label="b" />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  assert.equal(q(root, "[data-slot=slider-output]").textContent, "2 thumbs");
});

test("track fill-start / fill-end follow the value (single thumb)", async () => {
  const value = signal(0);
  const root = render(() => (
    <Slider value={value} aria-label="v">
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  const track = q(root, "[data-slot=slider-track]");
  assert.equal(track.getAttribute("data-fill-start"), null);
  assert.equal(track.getAttribute("data-fill-end"), null);
  value.set(40);
  await flush();
  assert.equal(track.getAttribute("data-fill-start"), "true");
  assert.equal(track.getAttribute("data-fill-end"), null);
  value.set(100);
  await flush();
  assert.equal(track.getAttribute("data-fill-end"), "true");
});

test("track fill-start / fill-end (range touching both ends)", () => {
  const root = renderRangeSlider({ defaultValue: [0, 1000] });
  const track = q(root, "[data-slot=slider-track]");
  assert.equal(track.getAttribute("data-fill-start"), "true");
  assert.equal(track.getAttribute("data-fill-end"), "true");
});

test("range fill spans the two thumbs", () => {
  const root = renderRangeSlider();
  const fill = q(root, "[data-slot=slider-fill]");
  assert.equal(fill.style.insetInlineStart, "10%");
  assert.equal(fill.style.width, "40%");
});

test("class merged with the slot class on every part; Marks slot", () => {
  const root = render(() => (
    <Slider class="w-full" defaultValue={40}>
      <Label class="font-medium">Brightness</Label>
      <Slider.Output class="text-xs" />
      <Slider.Track class="bg-default">
        <Slider.Fill class="bg-accent" />
        <Slider.Thumb class="bg-accent" />
        <Slider.Marks class="m" />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  const slots = sliderVariants({});
  assert.ok(q(root, "[data-slot=slider]").classList.contains("w-full"));
  assert.ok(q(root, "[data-slot=slider]").classList.contains(slots.base()));
  for (const [s, c] of [
    ["slider-output", "text-xs"],
    ["slider-track", "bg-default"],
    ["slider-fill", "bg-accent"],
    ["slider-thumb", "bg-accent"],
  ])
    assert.ok(q(root, `[data-slot=${s}]`).classList.contains(c!), s);
  const marks = q(root, "[data-slot=slider-marks]");
  assert.ok(marks.classList.contains(slots.marks()));
  assert.ok(marks.classList.contains("m"));
});

test("live class: root and thumb follow in place", async () => {
  const cls = signal("a");
  const root = render(() => (
    <Slider class={cls()} defaultValue={10} aria-label="v">
      <Slider.Track>
        <Slider.Thumb class={cls()} />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  const base = q(root, "[data-slot=slider]");
  const thumb = q(root, "[data-slot=slider-thumb]");
  assert.ok(base.classList.contains("a") && thumb.classList.contains("a"));
  cls.set("b");
  await flush();
  assert.equal(q(root, "[data-slot=slider]"), base);
  assert.ok(base.classList.contains("b") && !base.classList.contains("a"));
  assert.ok(base.classList.contains(sliderVariants({}).base()));
  assert.ok(thumb.classList.contains("b"));
});

test("render function on the root (upstream render-function demo)", () => {
  const root = render(() => (
    <Slider defaultValue={30} render={(props) => <div {...props} data-custom="foo" />}>
      <Label>Volume</Label>
      <Slider.Track>
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )).container as HTMLElement;
  const el = q(root, "[data-custom=foo]");
  assert.equal(el.getAttribute("data-slot"), "slider");
  assert.ok(el.classList.contains(sliderVariants({}).base()));
});

test("parts outside a Slider carry no slot class (Marks)", () => {
  const root = render(() => <SliderMarks class="m" />).container as HTMLElement;
  const marks = q(root, "[data-slot=slider-marks]");
  assert.equal(marks.className, "m");
});
