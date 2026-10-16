// T5 server: `<Motion.*>` renders its final state inline, the entrance as one CSS rule per distinct entrance through
// the head sink (request nonce, deduped per page), the custom-property form without a sink, nothing for static targets.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Provider, renderToString } from "@rivetjs/runtime/server";
import { ServerData } from "@rivetjs/router/route-context";
import type { Head, HeadSink } from "@rivetjs/router";
import { Motion, MotionElement } from "../index.tsx";
import { entranceRule } from "../css.ts";

const call = (component: unknown, props: object) => (component as (p: object) => unknown)(props);
function sink(closed = false) {
  const entries: Head[] = [];
  const value: HeadSink = {
    nonce: "n0",
    push(_level, head) {
      if (closed) return "<late>";
      entries.push(head);
      return undefined;
    },
  };
  return { entries, value };
}
const render = async (view: () => unknown, headSink?: HeadSink) =>
  String(
    await renderToString((() =>
      headSink
        ? Provider({ token: ServerData, value: { url: new URL("http://x.test/"), data: undefined, headSink } as never, children: view as never })
        : view()) as never),
  );

test("final state inline after the user's style + data-mve; one head rule per distinct entrance", async () => {
  const s = sink();
  const entrance = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
  const html = await render(
    () => [
      call(Motion.div, { ...entrance, style: { color: "red" }, class: "a", children: "x" }),
      call(Motion.p, { ...entrance }),
      call(Motion.span, { initial: { scale: 0.5 }, animate: { scale: 1 } }),
    ],
    s.value,
  );
  const rule = entranceRule(entrance.initial, entrance.animate, undefined)!;
  assert.match(
    html,
    new RegExp(
      `^<div class="a" style="color:red;opacity:1;translate:0px 0px" data-mve="${rule.hash}">x</div><p style="opacity:1;translate:0px 0px" data-mve="${rule.hash}"></p><span style="scale:1" data-mve="\\w+"></span>$`,
    ),
  );
  assert.equal(s.entries.length, 2);
  assert.deepEqual(s.entries[0], { styles: [{ css: rule.css, key: "rv-mve-" + rule.hash }] });
  assert.doesNotMatch(html, /<style/);
});

test("initial={false}, no initial, or a static target: final styles only, no rule", async () => {
  const s = sink();
  const html = await render(
    () => [
      call(MotionElement, { as: "div", initial: false, animate: { x: 10 } }),
      call(Motion.div, { animate: { opacity: 0.5 } }),
      call(Motion.div, { initial: { opacity: 1 }, animate: { opacity: 1 } }),
    ],
    s.value,
  );
  assert.equal(html, '<div style="translate:10px 0px"></div><div style="opacity:0.5"></div><div style="opacity:1"></div>');
  assert.equal(s.entries.length, 0);
});

test("variants + custom resolve on the server; keyframe entrances keep their final frame inline", async () => {
  const s = sink();
  const variants = { hidden: { opacity: 0 }, shown: (i: unknown) => ({ opacity: 1, x: (i as number) * 10 }) };
  const html = await render(() => call(Motion.li, { variants, initial: "hidden", animate: "shown", custom: 2 }), s.value);
  assert.match(html, /^<li style="opacity:1;translate:20px 0px" data-mve="\w+"><\/li>$/);
  const pulse = await render(() => call(Motion.b, { initial: { scale: 1 }, animate: { scale: [1, 1.2, 1] } }), s.value);
  assert.match(pulse, /^<b style="scale:1" data-mve="\w+"><\/b>$/);
  assert.match(String(s.entries[1]!.styles![0]!.css), /@keyframes rv-mve-\w+-1\{0%\{scale:1\}50%\{scale:1.2\}100%\{scale:1\}\}/);
});

test("no head sink: inline custom properties for entrance.css (data-mvv); inexpressible → final state", async () => {
  const html = await render(() => call(Motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }));
  assert.equal(
    html,
    '<div style="opacity:1;translate:0px 0px;--rv-mve-o:0;--rv-mve-t:0px 8px;--rv-mve-n:rv-mve-o,rv-mve-t;--rv-mve-nr:rv-mve-o;--rv-mve-d:500ms,500ms;--rv-mve-e:ease-out,ease-out;--rv-mve-l:0ms,0ms;--rv-mve-dr:500ms;--rv-mve-er:ease-out;--rv-mve-lr:0ms" data-mvv=""></div>',
  );
  const color = await render(() => call(Motion.div, { initial: { backgroundColor: "#000" }, animate: { backgroundColor: "#fff" } }));
  assert.equal(color, '<div style="background-color:#fff"></div>');
});

test("streamed boundary after the shell: the sink is closed, the element falls back to the custom-property form", async () => {
  const s = sink(true);
  const html = await render(() => call(Motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 } }), s.value);
  assert.match(html, /^<div style="opacity:1;--rv-mve-o:0;--rv-mve-n:rv-mve-o;--rv-mve-nr:rv-mve-o;[^"]*" data-mvv=""><\/div>$/);
});

test("reducedMotion per element is part of the rule (different hash)", async () => {
  const s = sink();
  await render(
    () => [
      call(Motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }),
      call(Motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, reducedMotion: "never" }),
    ],
    s.value,
  );
  assert.equal(s.entries.length, 2);
  assert.doesNotMatch(String(s.entries[1]!.styles![0]!.css), /@media/);
});

test("variant children follow the parent's labels; staggered entrances share one rule via --rv-mvi", async () => {
  const s = sink();
  const list = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  };
  const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
  const html = await render(
    () =>
      call(Motion.ul, {
        variants: list,
        initial: "hidden",
        animate: "show",
        children: () => [0, 1, 2].map(() => call(Motion.li, { variants: item })).concat([call(Motion.li, { variants: item, inherit: false })]),
      }),
    s.value,
  );
  const lis = html.match(/<li[^>]*>/g)!;
  assert.match(lis[0]!, /^<li style="opacity:1;translate:0px 0px;--rv-mvi:0" data-mve="(\w+)">$/);
  assert.match(lis[2]!, /--rv-mvi:2" data-mve=/);
  const hashes = new Set(lis.slice(0, 3).map((li) => li.match(/data-mve="(\w+)"/)![1]));
  assert.equal(hashes.size, 1);
  assert.equal(lis[3], "<li>");
  const childRule = s.entries.map((e) => e.styles![0]!.css).find((css) => css.includes([...hashes][0]!))!;
  assert.match(childRule, /calc\(var\(--rv-mvi,0\)\*50ms \+ 100ms\)/);
});

test("MotionConfig: transition default under the element's, reducedMotion for the elements inside", async () => {
  const { MotionConfig } = await import("../index.tsx");
  const s = sink();
  await render(
    () =>
      call(MotionConfig, {
        transition: { duration: 0.9 },
        reducedMotion: "never",
        children: () => [
          call(Motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 } }),
          call(Motion.p, { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }),
        ],
      }),
    s.value,
  );
  const [a, b] = s.entries.map((e) => e.styles![0]!.css);
  assert.match(a!, / 900ms /);
  assert.match(b!, / 200ms /);
  assert.doesNotMatch(a! + b!, /@media/);
});

test("layout / layoutId: data-layout + data-layout-id on the server (no layout code needed)", async () => {
  const html = await render(() => [
    call(Motion.div, { id: "a", layout: true }),
    call(Motion.div, { id: "b", layout: "size" }),
    call(Motion.div, { id: "c", layoutId: "pill" }),
    call(Motion.div, { id: "d" }),
  ]);
  assert.match(html, /id="a"[^>]*data-layout="true"/);
  assert.match(html, /id="b"[^>]*data-layout="size"/);
  assert.match(html, /id="c"[^>]*data-layout="true"[^>]*data-layout-id="pill"/);
  assert.doesNotMatch(html, /id="d"[^>]*data-layout/);
});
