// DOM-target suite: `Typography` (upstream typography stories as tests): element per type, Heading levels, Paragraph sizes, Code,
// Prose, align / color / weight / truncate classes, data-slot / data-type, `render`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Typography, TypographyRoot, Heading, Paragraph, Code, Prose, typographyVariants } = await import("../src/components/typography/index.ts");

test("typography: default = p.typography with data-slot / data-type", () => {
  const r = render(() => <Typography class="mt-2">Hello</Typography>);
  const el = r.container.firstElementChild!;
  assert.equal(el.tagName, "P");
  assert.equal(el.getAttribute("data-slot"), "typography");
  assert.equal(el.getAttribute("data-type"), "body");
  assert.equal(el.className, typographyVariants({ align: "start", color: "default", type: "body" }).base({ class: "mt-2" }));
  assert.equal(el.textContent, "Hello");
  r.unmount();
});

test("typography: every type renders its element", () => {
  const map = { h1: "H1", h2: "H2", h3: "H3", h4: "H4", h5: "H5", h6: "H6", body: "P", "body-sm": "P", "body-xs": "P", code: "CODE" } as const;
  for (const [type, tag] of Object.entries(map)) {
    const r = render(() => <Typography type={type as keyof typeof map}>t</Typography>);
    const el = r.container.firstElementChild!;
    assert.equal(el.tagName, tag, type);
    assert.equal(el.getAttribute("data-type"), type);
    assert.match(el.className, new RegExp(`typography--${type}\\b`));
    r.unmount();
  }
});

test("typography: Heading levels, Paragraph sizes, Code", () => {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    const r = render(() => <Typography.Heading level={level}>h</Typography.Heading>);
    assert.equal(r.container.firstElementChild?.tagName, `H${level}`);
    r.unmount();
  }
  const d = render(() => <Heading>default level</Heading>);
  assert.equal(d.container.firstElementChild?.tagName, "H1");
  d.unmount();
  for (const [size, type] of [
    [undefined, "body"],
    ["base", "body"],
    ["sm", "body-sm"],
    ["xs", "body-xs"],
  ] as const) {
    const r = render(() => <Paragraph size={size}>p</Paragraph>);
    assert.equal(r.container.firstElementChild?.getAttribute("data-type"), type);
    r.unmount();
  }
  const c = render(() => <Code>x</Code>);
  assert.equal(c.container.firstElementChild?.tagName, "CODE");
  c.unmount();
});

test("typography: align / color / weight / truncate modifiers", () => {
  const r = render(() => (
    <Typography align="center" color="muted" weight="semibold" truncate>
      t
    </Typography>
  ));
  const cls = r.container.firstElementChild!.className;
  for (const m of ["typography--align-center", "typography--color-muted", "typography--weight-semibold", "typography--truncate"])
    assert.match(cls, new RegExp(m));
  r.unmount();
});

test("typography: Prose = div.typography-prose data-slot=prose; render prop; ref; exports", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Typography.Prose class="max-w-xl" ref={(e: Element) => (el = e)}>
      <p>x</p>
    </Typography.Prose>
  ));
  assert.equal(el?.tagName, "DIV");
  assert.equal(el?.getAttribute("data-slot"), "prose");
  assert.equal(el?.className, "typography-prose max-w-xl");
  r.unmount();
  const p = render(() => <Prose render={(props) => <article {...(props as {})} />}>y</Prose>);
  assert.equal(p.container.firstElementChild?.tagName, "ARTICLE");
  assert.equal(p.container.firstElementChild?.getAttribute("data-slot"), "prose");
  p.unmount();
  assert.equal(Typography, TypographyRoot);
  assert.equal(Typography.Heading, Heading);
});

test("typography: render prop on a Typography text (cdk Text render)", () => {
  const r = render(() => (
    <Typography type="body" render={(props) => <section {...(props as {})} />}>
      z
    </Typography>
  ));
  const el = r.container.firstElementChild!;
  assert.equal(el.tagName, "SECTION");
  assert.equal(el.getAttribute("data-slot"), "typography");
  assert.match(el.className, /typography--body/);
  r.unmount();
});
