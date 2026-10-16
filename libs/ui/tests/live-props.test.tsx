// DOM-target suite (happy-dom): live props (docs/design/specs/2026-10-07-live-props-design.md, P1/P2) on client-created
// components. `<X prop={s()}>` passes a getter; the component reads it lazily, so a change updates the classes / context
// readers in place (same nodes, body not re-run). Resumed pages: tests-components/card.test.ts, resume.test.ts, wave1.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Card } = await import("../src/components/card/index.ts");
const { Surface, SurfaceContext } = await import("../src/components/surface/index.ts");
const { Button, buttonVariants } = await import("../src/components/button/index.ts");
const { Chip, chipVariants } = await import("../src/components/chip/index.ts");
const { hasLiveProp } = await import("../src/utils/live.tsx");

test("live props: hasLiveProp tells getters from data properties", () => {
  const v = signal("a");
  assert.equal(hasLiveProp({ a: 1 }, ["a"]), false);
  assert.equal(
    hasLiveProp(
      {
        get a() {
          return v();
        },
      },
      ["b", "a"],
    ),
    true,
  );
});

test("live props: <Card variant={v()}> updates root, keeps root + parts, SurfaceContext follows (transparent → outer)", () => {
  const v = signal<"default" | "secondary" | "tertiary" | "transparent">("default");
  const Probe = () => {
    const surface = useContext(SurfaceContext);
    return <i id="probe" data-surface={surface.variant ?? "none"} />;
  };
  const r = render(() => (
    <Surface variant="tertiary">
      <Card id="c" variant={v()} class="w">
        <Card.Header id="h">
          <Card.Title id="t">T</Card.Title>
        </Card.Header>
        <Probe />
      </Card>
    </Surface>
  ));
  const nodes = ["#c", "#h", "#t", "#probe"].map((sel) => r.find(sel));
  assert.equal(r.find("#c")?.getAttribute("class"), "card card--default w");
  assert.equal(r.find("#probe")?.getAttribute("data-surface"), "default");
  for (const [next, surface] of [
    ["secondary", "secondary"],
    ["transparent", "tertiary"],
    ["tertiary", "tertiary"],
    ["default", "default"],
  ] as const) {
    v.set(next);
    assert.equal(r.find("#c")?.getAttribute("class"), `card card--${next} w`);
    assert.equal(r.find("#h")?.getAttribute("class"), "card__header");
    assert.equal(r.find("#t")?.getAttribute("class"), "card__title");
    assert.equal(r.find("#probe")?.getAttribute("data-surface"), surface, next);
    ["#c", "#h", "#t", "#probe"].forEach((sel, i) => assert.ok(r.find(sel) === nodes[i], `${sel} kept (${next})`));
  }
  r.unmount();
});

test("live props: <Card class={c()}> and part class follow", () => {
  const c = signal("a");
  const r = render(() => (
    <Card id="c" class={c()}>
      <Card.Footer id="f" class={c()} />
    </Card>
  ));
  c.set("b");
  assert.equal(r.find("#c")?.getAttribute("class"), "card card--default b");
  assert.equal(r.find("#f")?.getAttribute("class"), "card__footer b");
  r.unmount();
});

test("live props: <Surface variant={v()}> class + context follow", () => {
  const v = signal<"default" | "secondary">("default");
  const Probe = () => {
    const surface = useContext(SurfaceContext);
    return <i id="probe" data-surface={surface.variant ?? "none"} />;
  };
  const r = render(() => (
    <Surface id="s" variant={v()}>
      <Probe />
    </Surface>
  ));
  const el = r.find("#s");
  v.set("secondary");
  assert.equal(r.find("#s")?.getAttribute("class"), "surface surface--secondary");
  assert.equal(r.find("#probe")?.getAttribute("data-surface"), "secondary");
  assert.ok(r.find("#s") === el, "node kept");
  r.unmount();
});

test("live props: <Button variant={v()} size={s()} isDisabled={d()}> updates the same <button>", () => {
  const v = signal<"primary" | "secondary" | "danger">("primary");
  const size = signal<"sm" | "md" | "lg">("md");
  const d = signal(false);
  const r = render(() => (
    <Button id="b" variant={v()} size={size()} isDisabled={d()}>
      x
    </Button>
  ));
  const el = r.find("#b");
  assert.equal(el?.getAttribute("class"), buttonVariants({ variant: "primary", size: "md" }));
  v.set("danger");
  size.set("lg");
  d.set(true);
  assert.equal(r.find("#b")?.getAttribute("class"), buttonVariants({ variant: "danger", size: "lg" }));
  assert.equal(r.find("#b")?.hasAttribute("disabled"), true);
  assert.equal(r.find("#b")?.getAttribute("data-disabled"), "true");
  v.set("secondary");
  d.set(false);
  assert.equal(r.find("#b")?.getAttribute("class"), buttonVariants({ variant: "secondary", size: "lg" }));
  assert.equal(r.find("#b")?.hasAttribute("disabled"), false);
  assert.ok(r.find("#b") === el, "button node kept");
  r.unmount();
});

test("live props: a live Button variant composes with a render-prop class function", () => {
  const v = signal<"primary" | "ghost">("primary");
  const r = render(() => (
    <Button id="b" variant={v()} class={({ isDisabled }) => (isDisabled() ? "off" : "on")}>
      x
    </Button>
  ));
  assert.equal(r.find("#b")?.getAttribute("class"), buttonVariants({ variant: "primary" }) + " on");
  v.set("ghost");
  assert.equal(r.find("#b")?.getAttribute("class"), buttonVariants({ variant: "ghost" }) + " on");
  r.unmount();
});

test("live props: <Chip color={c()} variant={v()}> root + label follow, nodes kept", () => {
  const c = signal<"accent" | "danger">("accent");
  const v = signal<"primary" | "soft">("primary");
  const r = render(() => (
    <Chip id="c" color={c()} variant={v()}>
      hi
    </Chip>
  ));
  const root = r.find("#c");
  const label = r.find("[data-slot=chip-label]");
  c.set("danger");
  v.set("soft");
  const slots = chipVariants({ color: "danger", variant: "soft" });
  assert.equal(r.find("#c")?.getAttribute("class"), slots.base());
  assert.equal(r.find("[data-slot=chip-label]")?.getAttribute("class"), slots.label());
  assert.ok(r.find("#c") === root && r.find("[data-slot=chip-label]") === label, "nodes kept");
  r.unmount();
});
