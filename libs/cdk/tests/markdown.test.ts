// `@rivetjs/cdk/markdown` (Rivet-authored safe Markdown parser; feature set inspired by HeroUI Pro's public Markdown docs):
// block split for streaming keys, CommonMark / GFM subset AST, safe URLs, raw HTML stays text, open-mark repair.
import { test } from "vitest";
import assert from "node:assert/strict";
import { closeOpenMarks, parseInline, parseMarkdown, safeUrl, splitBlocks, textOf } from "../markdown/index.tsx";
import type { MarkdownBlock } from "../markdown/index.tsx";

test("markdown: splitBlocks keeps fences, lists and quotes together", () => {
  const src = "# H\n\npara one\nline two\n\n```js\na\n\nb\n```\n\n- a\n\n- b\n\n> q\n> r\n\n---\n\ntail";
  const blocks = splitBlocks(src);
  assert.deepEqual(blocks, ["# H", "para one\nline two", "```js\na\n\nb\n```", "- a\n\n- b", "> q\n> r", "---", "tail"]);
  // Each block parses to the same nodes as the whole source.
  assert.deepEqual(
    blocks.flatMap((b) => parseMarkdown(b)),
    parseMarkdown(src),
  );
});

test("markdown: blocks", () => {
  const ast = parseMarkdown("Title\n===\n\n## Sub ##\n\n1. one\n2. two\n\n- [x] done\n- [ ] todo\n\n| a | b |\n|:-:|--:|\n| 1 | 2 |\n\n```py\nx\n");
  assert.equal(ast[0]!.type, "heading");
  assert.equal((ast[0] as { level: number }).level, 1);
  assert.equal(textOf((ast[1] as Extract<MarkdownBlock, { type: "heading" }>).children), "Sub");
  const ordered = ast[2] as { type: "list"; ordered: boolean; start: number; items: unknown[] };
  assert.equal(ordered.ordered, true);
  assert.equal(ordered.items.length, 2);
  const tasks = ast[3] as { items: { checked?: boolean }[] };
  assert.deepEqual(
    tasks.items.map((i) => i.checked),
    [true, false],
  );
  const table = ast[4] as { type: "table"; align: unknown[]; rows: unknown[][] };
  assert.equal(table.type, "table");
  assert.deepEqual(table.align, ["center", "right"]);
  assert.equal(table.rows.length, 1);
  const code = ast[5] as { type: "code"; lang: string; value: string; closed: boolean };
  assert.deepEqual([code.type, code.lang, code.value, code.closed], ["code", "py", "x", false]);
});

test("markdown: inline + safety", () => {
  const nodes = parseInline(
    '**b** *e* ~~d~~ `c` [l](https://x.dev "t") [bad](javascript:alert(1)) ![i](data:image/png;base64,x) <b>raw</b> \\*esc\\* https://auto.dev',
  );
  const types = nodes.map((n) => n.type);
  assert.ok(types.includes("strong") && types.includes("em") && types.includes("del") && types.includes("code"));
  const links = nodes.filter((n) => n.type === "link") as { href: string; title?: string }[];
  assert.deepEqual(
    links.map((l) => l.href),
    ["https://x.dev", "https://auto.dev"],
  );
  assert.equal(links[0]!.title, "t");
  assert.equal(
    nodes.some((n) => n.type === "image"),
    false,
  );
  assert.match(textOf(nodes), /<b>raw<\/b>/);
  assert.match(textOf(nodes), /\*esc\*/);
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl(" JaVaScRiPt:x"), undefined);
  assert.equal(safeUrl("/docs#a"), "/docs#a");
  assert.equal(safeUrl("mailto:a@b.c"), "mailto:a@b.c");
});

test("markdown: closeOpenMarks", () => {
  assert.equal(closeOpenMarks("a **bold"), "a **bold**");
  assert.equal(closeOpenMarks("a **"), "a ");
  assert.equal(closeOpenMarks("x `co"), "x `co`");
  assert.equal(closeOpenMarks("~~a **b"), "~~a **b**~~");
  assert.equal(closeOpenMarks("done **b**"), "done **b**");
  assert.equal(closeOpenMarks("```js\nlet a = '**"), "```js\nlet a = '**");
  // Closers before trailing whitespace (a stream chunk ending in a space must still render as strong).
  assert.equal(closeOpenMarks("the **speckled "), "the **speckled** ");
  assert.equal(closeOpenMarks("~~a **b \n"), "~~a **b**~~ \n");
  assert.deepEqual(parseMarkdown(closeOpenMarks("the **speckled mug ")), [
    {
      type: "paragraph",
      children: [
        { type: "text", value: "the " },
        { type: "strong", children: [{ type: "text", value: "speckled mug" }] },
      ],
    },
  ]);
  assert.equal(closeOpenMarks("x `co "), "x `co `");
});
