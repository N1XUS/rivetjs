// Server-target suite: `Breadcrumbs` SSR — list markup, BEM classes, current item, default separators (lucide svg) between items.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Breadcrumbs } from "../index.ts";
import { assertSameHtml } from "./same-html.ts";

test("breadcrumbs SSR: markup + classes + separators", async () => {
  const html = await renderToString(() => (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#p">Products</Breadcrumbs.Item>
      <Breadcrumbs.Item>Laptop</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  assert.match(html, /<ol[^>]*class="breadcrumbs"/);
  assert.match(html, /data-slot="breadcrumbs"/);
  assert.equal(html.match(/data-slot="breadcrumbs-item"/g)?.length, 3);
  assert.equal(html.match(/data-slot="breadcrumbs-separator"/g)?.length, 2);
  assert.match(html, /<a[^>]*class="link breadcrumbs__link"[^>]*href="#home"|<a[^>]*href="#home"[^>]*class="link breadcrumbs__link"/);
  assert.match(html, /data-current="true"/);
  assert.match(html, /aria-current="page"/);
});

test("breadcrumbs SSR: custom separator wrapped with the slot class", async () => {
  const html = await renderToString(() => (
    <Breadcrumbs separator={<span class="sep">/</span>}>
      <Breadcrumbs.Item href="#a">A</Breadcrumbs.Item>
      <Breadcrumbs.Item>B</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  assert.match(html, /<span class="breadcrumbs__separator" data-slot="breadcrumbs-separator"><span class="sep">\/<\/span><\/span>/);
});

test("breadcrumbs SSR: items without a render function = Breadcrumbs.Item per entry", async () => {
  const items = [{ label: "Home", href: "/" }, { label: "Docs", href: "/docs" }, { label: "Breadcrumbs" }];
  await assertSameHtml(
    () => <Breadcrumbs items={items} />,
    () => (
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/docs">Docs</Breadcrumbs.Item>
        <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
      </Breadcrumbs>
    ),
  );
});
