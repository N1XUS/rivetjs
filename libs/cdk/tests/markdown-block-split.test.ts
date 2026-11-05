// `createBlockSplit` (incremental `splitBlocks` for streamed responses): every call equals `splitBlocks(source)` — for
// each prefix of varied documents (streamed one code unit at a time and in chunks), for edits and replacements, and for
// `\r\n` / lone `\r` line breaks split across chunks; finished blocks keep their string identity; a long stream is
// linear (finished blocks are not rescanned).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createBlockSplit, splitBlocks } from "../markdown/index.tsx";

const DOCS = [
  "# H\n\npara one\nline two\n\n```js\na\n\nb\n```\n\n- a\n\n- b\n\n> q\n> r\n\n---\n\ntail",
  "- a\n\n\n\n- b\n\n\npara\n\n> q\n\n> r\n\nafter\n\n  indented\n\n- x\n\n  continued\n\nend",
  "Title\n=====\n\nSub\n---\n\npara\n***\n\n~~~\nfence ~~~\n~~~\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n1. one\n2. two\n\n3) three",
  "line\r\n\r\npara\r\nmore\r\n\r\n- item\r\n\r\n  cont\r\n\r\n# head\r\n\rold mac\r\rtext",
  "```\nunclosed fence\n\n\nstill code",
  "> quote\n>\n> more\n\n\n\n- list\n-\n\n- after\n\n# end\n",
];

function check(chunks: readonly string[]): void {
  const split = createBlockSplit();
  let source = "";
  for (const chunk of chunks) {
    source += chunk;
    assert.deepEqual(split(source), splitBlocks(source), JSON.stringify(source));
  }
}

test("createBlockSplit equals splitBlocks for every prefix (one code unit and 7-unit chunks)", () => {
  for (const doc of DOCS) {
    check([...doc]);
    const chunks: string[] = [];
    for (let i = 0; i < doc.length; i += 7) chunks.push(doc.slice(i, i + 7));
    check(chunks);
  }
  // Every document after every other: line breaks and block kinds meet at every boundary.
  for (const a of DOCS) for (const b of DOCS) check([...(a + "\n" + b)]);
});

test("createBlockSplit: replacements, edits before the resume point and repeats", () => {
  const split = createBlockSplit();
  const sources = [
    "# A\n\npara\n\nmore",
    "# A\n\npara\n\nmore text\n\n",
    "# B\n\npara\n\nmore text\n\nnew",
    "",
    "x\n\ny",
    "x\n\ny",
    "x\r",
    "x\r\n\r\ny",
    "- a\n\n",
    "- a\n\n- b",
  ];
  for (const source of sources) assert.deepEqual(split(source), splitBlocks(source), JSON.stringify(source));
});

test("createBlockSplit keeps finished block strings and stays linear", () => {
  const unit = (i: number) => `## Section ${i}\n\nSome **text** ${i}.\n\n- a\n- b\n\n\`\`\`ts\nconst x = ${i};\n\`\`\`\n\n`;
  let doc = "";
  for (let i = 0; doc.length < 60000; i++) doc += unit(i);
  const split = createBlockSplit();
  let previous: string[] = [];
  let reused = 0;
  const t0 = performance.now();
  for (let n = 16; n <= doc.length; n += 16) {
    const blocks = split(doc.slice(0, n));
    for (let i = 0; i < blocks.length - 2 && i < previous.length; i++) if (blocks[i] === previous[i]) reused++;
    previous = blocks;
  }
  const incremental = performance.now() - t0;
  assert.deepEqual(previous, splitBlocks(doc.slice(0, doc.length - (doc.length % 16))));
  assert.ok(reused > 0);
  const t1 = performance.now();
  for (let n = 16; n <= doc.length; n += 1600) splitBlocks(doc.slice(0, n));
  // One hundredth of the full rescans costs about as much as the whole incremental stream; was O(n²): 100x.
  const sampled = performance.now() - t1;
  assert.ok(incremental < sampled * 20 + 20, `incremental ${incremental.toFixed(1)} ms, 1/100 of the full rescans ${sampled.toFixed(1)} ms`);
});
