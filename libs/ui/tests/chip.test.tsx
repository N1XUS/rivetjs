// DOM-target suite: `Chip` (upstream chip tests ported): string/number children wrapped in `Chip.Label`, element children not,
// slot classes through context, standalone Label.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Chip, ChipRoot, ChipLabel, chipVariants } = await import("../src/components/chip/index.ts");

test("chip: string children are wrapped in chip__label with the context slot class", () => {
  const r = render(() => (
    <Chip color="success" size="lg" class="m-1">
      text
    </Chip>
  ));
  const el = r.container.firstElementChild!;
  assert.equal(el.getAttribute("data-slot"), "chip");
  assert.equal(el.className, chipVariants({ color: "success", size: "lg", variant: "secondary" }).base({ class: "m-1" }));
  assert.match(el.className, /chip--success/);
  const label = el.querySelector(".chip__label")!;
  assert.equal(label.textContent, "text");
  assert.equal(label.getAttribute("data-slot"), "chip-label");
  r.unmount();
});

test("chip: number children wrapped; element children are not", () => {
  const n = render(() => <Chip>{5}</Chip>);
  assert.equal(n.container.querySelector(".chip__label")?.textContent, "5");
  n.unmount();
  const e = render(() => (
    <Chip>
      <b>bold</b>
    </Chip>
  ));
  assert.equal(e.container.querySelector(".chip__label"), null);
  assert.equal(e.container.querySelector("b")?.textContent, "bold");
  e.unmount();
});

test("chip: Chip.Label inside reads the context; outside only its class; ref; index exports", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Chip variant="primary" ref={(e: Element) => (el = e)}>
      <Chip.Label class="x">l</Chip.Label>
    </Chip>
  ));
  assert.equal(r.container.querySelector("[data-slot=chip-label]")?.className, "chip__label x");
  assert.match(el!.className, /chip--primary/);
  r.unmount();
  const o = render(() => <ChipLabel class="solo">s</ChipLabel>);
  assert.equal(o.container.firstElementChild?.className, "solo");
  o.unmount();
  assert.equal(Chip, ChipRoot);
  assert.equal(Chip.Root, ChipRoot);
});

test("chip: expression children (`{name}`, lazy slots) are wrapped when they resolve to text, and follow signals", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const name = signal("a");
  const r = render(() => <Chip>{name()}</Chip>);
  assert.equal(r.container.querySelector(".chip__label")?.textContent, "a");
  name.set("b");
  assert.equal(r.container.querySelector(".chip__label")?.textContent, "b");
  r.unmount();
  const e = render(() => <Chip>{name() ? <b>el</b> : null}</Chip>);
  assert.equal(e.container.querySelector(".chip__label"), null);
  assert.equal(e.container.querySelector("b")?.textContent, "el");
  e.unmount();
});

test("chip: hard-coded defaults equal chipVariants defaultVariants (re-vendor drift guard)", () => {
  const r = render(() => <Chip>x</Chip>);
  const chip = r.container.querySelector("[data-slot=chip]")!;
  assert.equal(chip.className, chipVariants().base());
  assert.equal(chip.querySelector("[data-slot=chip-label]")?.className, chipVariants().label());
  r.unmount();
});
