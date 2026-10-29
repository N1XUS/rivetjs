// DOM-target suite: `Markdown` `components` override map (scoped from public docs of commercial UI kits): per-node-type element
// replacement for blocks and inline nodes, defaults kept for the rest, props (class / attrs / children), fenced code `pre`,
// and the streaming keyed rendering intact with overrides (finished block nodes kept, live tail renders overrides).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Markdown } = await import("../src/components/markdown/index.ts");
const flush = () => new Promise((r) => setTimeout(r, 20));

const SOURCE = [
  "# Title",
  "",
  "Some **bold**, *em*, ~~del~~, `code` and [link](https://example.com).",
  "",
  "> quote",
  "",
  "1. one",
  "2. two",
  "",
  "- [x] done",
  "",
  "| a | b |",
  "|:--|--:|",
  "| 1 | 2 |",
  "",
  "---",
  "",
  "```js",
  "let x = 1;",
  "```",
].join("\n");

test("markdown components: overrides replace elements, others keep defaults", () => {
  const r = render(() => (
    <Markdown
      content={SOURCE}
      components={{
        h1: (p) => (
          <h2 class={p.class} data-custom="h1" data-level={p.level}>
            {p.children}
          </h2>
        ),
        a: (p) => (
          <a class={p.class} href={p.href} data-custom="a" target={p.target} rel={p.rel}>
            {p.children}
          </a>
        ),
        code: (p) => <kbd data-custom="code">{p.children}</kbd>,
        strong: (p) => <b data-custom="strong">{p.children}</b>,
        em: (p) => <i data-custom="em">{p.children}</i>,
        del: (p) => <s data-custom="del">{p.children}</s>,
        blockquote: (p) => <aside data-custom="quote">{p.children}</aside>,
        ol: (p) => <ol data-custom="ol">{p.children}</ol>,
        li: (p) => <li data-custom="li">{p.children}</li>,
        hr: () => <div data-custom="hr" />,
        table: (p) => (
          <table class={p.class} data-custom="table">
            {p.children}
          </table>
        ),
        th: (p) => (
          <th scope={p.scope} data-custom="th">
            {p.children}
          </th>
        ),
        td: (p) => <td data-custom="td">{p.children}</td>,
        input: (p) => <input type="checkbox" checked={p.checked} disabled data-custom="input" />,
        pre: (p) => (
          <pre data-custom="pre" data-lang={p.language} data-closed={String(p.closed)}>
            {p.code}
          </pre>
        ),
      }}
    />
  ));
  const root = r.container.querySelector("[data-slot=markdown]")!;
  const h = root.querySelector("[data-custom=h1]")!;
  assert.equal(h.tagName, "H2");
  assert.equal(h.textContent, "Title");
  assert.equal(h.getAttribute("data-level"), "1");
  assert.match(h.getAttribute("class")!, /markdown__heading--1/);
  assert.equal(root.querySelector("h1"), null);
  const a = root.querySelector("[data-custom=a]")!;
  assert.equal(a.getAttribute("href"), "https://example.com");
  assert.equal(a.textContent, "link");
  assert.equal(a.getAttribute("class"), "markdown__link");
  assert.equal(root.querySelector("[data-custom=code]")!.tagName, "KBD");
  assert.equal(root.querySelector("[data-custom=strong]")!.textContent, "bold");
  assert.equal(root.querySelector("[data-custom=em]")!.textContent, "em");
  assert.equal(root.querySelector("[data-custom=del]")!.textContent, "del");
  assert.equal(root.querySelector("[data-custom=quote]")!.textContent, "quote");
  assert.equal(root.querySelectorAll("[data-custom=li]").length, 3, "two ordered items + the task item");
  assert.equal(root.querySelector("[data-custom=ol]")!.children.length, 2);
  assert.ok(root.querySelector("[data-custom=hr]"));
  assert.equal(root.querySelectorAll("[data-custom=th]").length, 2);
  assert.equal(root.querySelectorAll("[data-custom=td]").length, 2);
  assert.ok(root.querySelector("[data-custom=table] thead") && root.querySelector("[data-custom=table] tbody"));
  assert.ok(root.querySelector("[data-custom=input]"));
  const pre = root.querySelector("[data-custom=pre]")!;
  assert.equal(pre.getAttribute("data-lang"), "js");
  assert.equal(pre.getAttribute("data-closed"), "true");
  assert.equal(pre.textContent, "let x = 1;");
  assert.equal(root.querySelector(".code-block"), null, "default CodeBlock replaced");
  // not overridden: paragraphs keep the defaults
  assert.ok(root.querySelector("p.markdown__paragraph"));
  r.unmount();
});

test("markdown components: no map = unchanged defaults", () => {
  const r = render(() => <Markdown content={"# T\n\n[x](https://a.b) `c`"} components={{}} />);
  assert.ok(r.container.querySelector("h1.markdown__heading"));
  assert.ok(r.container.querySelector("a.markdown__link"));
  assert.ok(r.container.querySelector("code.markdown__inline-code"));
  r.unmount();
});

test("markdown components: streaming keeps finished blocks and the live tail renders overrides", async () => {
  const text = signal("# Plan\n\nFirst [lin");
  const streaming = signal(true);
  const r = render(() => (
    <Markdown
      content={() => text()}
      isStreaming={() => streaming()}
      components={{
        h1: (p) => (
          <h1 class={p.class} data-custom="h1">
            {p.children}
          </h1>
        ),
        a: (p) => (
          <a class={p.class} data-custom="a" href={p.href}>
            {p.children}
          </a>
        ),
        strong: (p) => <b data-custom="strong">{p.children}</b>,
      }}
    />
  ));
  const root = r.container.querySelector("[data-slot=markdown]")!;
  const heading = root.querySelector("[data-custom=h1]")!;
  assert.ok(heading);
  text.set("# Plan\n\nFirst [link](https://example.com) and **bo");
  await flush();
  assert.equal(root.querySelector("[data-custom=h1]"), heading, "finished heading node kept");
  const a = root.querySelector("[data-custom=a]")!;
  assert.equal(a.getAttribute("href"), "https://example.com");
  assert.equal(root.querySelector("[data-custom=strong]")!.textContent, "bo");
  text.set("# Plan\n\nFirst [link](https://example.com) and **bold** more");
  await flush();
  assert.equal(root.querySelector("[data-custom=a]"), a, "tail node kept while it grows");
  assert.equal(root.querySelector("[data-custom=strong]")!.textContent, "bold");
  assert.equal(root.querySelectorAll(".markdown__caret").length, 1);
  streaming.set(false);
  await flush();
  assert.equal(root.querySelectorAll(".markdown__caret").length, 0);
  assert.equal(root.querySelector("[data-custom=h1]"), heading);
  assert.ok(root.querySelector("[data-custom=a]"));
  r.unmount();
});

test("markdown components: streaming open fence goes through `pre` with a live code accessor", async () => {
  const text = signal("```js\nlet a");
  const r = render(() => (
    <Markdown
      content={() => text()}
      isStreaming
      components={{
        pre: (p) => (
          <pre data-custom="pre" data-closed={String(p.closed)}>
            {() => p.code}
          </pre>
        ),
      }}
    />
  ));
  const pre = r.container.querySelector("[data-custom=pre]")!;
  assert.equal(pre.getAttribute("data-closed"), "false");
  assert.match(pre.textContent!, /let a/);
  r.unmount();
});
