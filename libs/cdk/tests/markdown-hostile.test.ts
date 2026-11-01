// `@rivetjs/cdk/markdown` on hostile input (untrusted model / user text, parsed during SSR and per streamed chunk):
// work stays linear in the input and nesting depth is capped, so one message cannot block the event loop or overflow the stack.
import { test } from "vitest";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown, textOf } from "../markdown/index.tsx";
import type { MarkdownBlock, MarkdownInline } from "../markdown/index.tsx";

const N = 40_000;

function timed(label: string, source: string, budget = 400): MarkdownBlock[] {
  const start = performance.now();
  const ast = parseMarkdown(source);
  const ms = performance.now() - start;
  assert.ok(ms < budget, `${label}: ${ms.toFixed(0)} ms for ${source.length} chars (budget ${budget} ms)`);
  return ast;
}

/** Every text value in the tree, in order. */
function allText(blocks: readonly MarkdownBlock[]): string {
  let s = "";
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading") s += textOf(b.children);
    else if (b.type === "blockquote") s += allText(b.children);
    else if (b.type === "list") for (const item of b.items) s += allText(item.children);
    else if (b.type === "code") s += b.value;
  }
  return s;
}

function depthOf(blocks: readonly MarkdownBlock[]): number {
  let max = 0;
  for (const b of blocks) {
    if (b.type === "blockquote") max = Math.max(max, 1 + depthOf(b.children));
    else if (b.type === "list") for (const item of b.items) max = Math.max(max, 1 + depthOf(item.children));
  }
  return max;
}

function inlineDepth(nodes: readonly MarkdownInline[]): number {
  let max = 0;
  for (const n of nodes) if ("children" in n) max = Math.max(max, 1 + inlineDepth(n.children));
  return max;
}

test("markdown: unclosed brackets, link destinations and emphasis openers parse in linear time", () => {
  timed("[ x N", "[".repeat(N));
  timed("![ x N", "![".repeat(N / 2));
  timed("[ x N then ] x N", "[".repeat(N / 2) + "]".repeat(N / 2));
  timed("[a]( + whitespace", "[a](" + " ".repeat(N) + "x");
  timed("[a](b + whitespace", "[a](b" + " ".repeat(N) + "x");
  timed("*a x N", "*a ".repeat(N / 3));
  timed("**a x N", "**a ".repeat(N / 4));
  timed("_a x N", "_a ".repeat(N / 3));
  timed("~~a x N", "~~a ".repeat(N / 4));
  timed("one long paragraph", "a\n".repeat(N / 2));
});

test("markdown: link, destination and emphasis results are unchanged by the linear scans", () => {
  // Golden output of the parser before the scans were cached: same rules, only the work changed.
  const golden: [string, string][] = [
    [
      '[a [b] c](u) [x](y "t") [ ( "a b")',
      '[{"type":"link","href":"u","children":[{"type":"text","value":"a [b] c"}]},{"type":"text","value":" "},{"type":"link","href":"y","title":"t","children":[{"type":"text","value":"x"}]},{"type":"text","value":" [ ( \\"a b\\")"}]',
    ],
    [
      "[e]( \"a b\") [f](<a>b) [g](  <u>  't'  ) [h]( )",
      '[{"type":"link","href":"","title":"a b","children":[{"type":"text","value":"e"}]},{"type":"text","value":" "},{"type":"link","href":"a>","children":[{"type":"text","value":"f"}]},{"type":"text","value":" "},{"type":"link","href":"u","title":"t","children":[{"type":"text","value":"g"}]},{"type":"text","value":" "},{"type":"link","href":"","children":[{"type":"text","value":"h"}]}]',
    ],
    [
      "[[a]](u) [b](c\\ d) *x *y* z*",
      '[{"type":"link","href":"u","children":[{"type":"text","value":"[a]"}]},{"type":"text","value":" "},{"type":"link","href":"c\\\\ d","children":[{"type":"text","value":"b"}]},{"type":"text","value":" "},{"type":"em","children":[{"type":"text","value":"x *y"}]},{"type":"text","value":" z*"}]',
    ],
    [
      "*a *b c* `*` d*",
      '[{"type":"em","children":[{"type":"text","value":"a *b c"}]},{"type":"text","value":" "},{"type":"code","value":"*"},{"type":"text","value":" d*"}]',
    ],
    ["a  \nb\\\nc \nd", '[{"type":"text","value":"a"},{"type":"br"},{"type":"text","value":"b"},{"type":"br"},{"type":"text","value":"c\\nd"}]'],
  ];
  for (const [source, json] of golden) assert.equal(JSON.stringify(parseInline(source)), json, source);
});

test("markdown: deep block quote / list / link nesting is capped instead of overflowing the stack", () => {
  for (const [label, source] of [
    ["> x 20000", "> ".repeat(20_000) + "deep"],
    ["- x 20000", "- ".repeat(20_000) + "deep"],
    ["1. x 20000", "1. ".repeat(20_000) + "deep"],
    ["> - x 10000", "> - ".repeat(10_000) + "deep"],
  ] as const) {
    const ast = timed(label, source, 1500);
    const depth = depthOf(ast);
    assert.ok(depth <= 32 && depth >= 30, `${label}: depth ${depth}`);
    assert.ok(allText(ast).endsWith("deep"), `${label}: innermost text kept`);
  }
  const links = "[".repeat(20_000) + "deep" + "](u)".repeat(20_000);
  const start = performance.now();
  const nodes = parseInline(links);
  assert.ok(performance.now() - start < 1500);
  const depth = inlineDepth(nodes);
  assert.ok(depth <= 32 && depth >= 30, `links: depth ${depth}`);
  assert.ok(textOf(nodes).includes("deep"));
  // Ordinary nesting keeps its structure.
  assert.equal(depthOf(parseMarkdown("> ".repeat(8) + "x")), 8);
  assert.equal(inlineDepth(parseInline("[".repeat(8) + "x" + "](u)".repeat(8))), 8);
});
