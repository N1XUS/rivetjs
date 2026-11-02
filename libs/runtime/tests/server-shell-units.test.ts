// Direct units for the shell-cache watch and the row-template path walk (otherwise covered only through router e2e).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { shellHoles, shellWritten, type ShellHoles } from "../server-shell.ts";
import { rowContent, rowPaths, rowTexts } from "../server-resume-paths.ts";

const retained = (over: Partial<ShellHoles>): ShellHoles => ({ holes: [], n: 0, ids: 0, prefix: "", watch: [], check: () => null, ...over }) as ShellHoles;

test("shellWritten: unchanged frames have no reason", () => {
  const shared = signal(1);
  assert.equal(shellWritten(retained({ watch: [[shared, 1]] })), null);
});

test("shellWritten: a watched signal written by a hole makes the entry replay-only", () => {
  const shared = signal(1);
  const holes = retained({ watch: [[shared, 1]] });
  shared.set(2);
  assert.match(shellWritten(holes)!, /hole wrote a signal/);
});

test("shellWritten: the derived check's reason wins over the watch", () => {
  const shared = signal(1);
  shared.set(2);
  assert.equal(shellWritten(retained({ watch: [[shared, 1]], check: () => "derived" })), "derived");
});

test("shellHoles outside a streaming render throws", () => {
  assert.throws(() => shellHoles(retained({}))(), /need a streaming resumable render/);
});

test("rowContent: only the slots outside a start tag", () => {
  assert.deepEqual(rowContent(["<li>", "</li>"]), [0]);
  assert.deepEqual(rowContent(["<li", ">", "</li>"]), [1]);
});

test("rowTexts: a sole-child slot gets its element's path, mixed content does not", () => {
  const sole = rowTexts(["<dl><dd>", "</dd></dl>"], [null]);
  assert.equal(sole?.length, 1);
  assert.equal(sole![0]![0], 0);
  assert.match(sole![0]![1], /^dd:/);
  assert.equal(rowTexts(["<p>a ", " b</p>"], [null]), null);
});

test("rowPaths: an `_rId` slot inside a start tag names its element; outside a tag it refuses", () => {
  const paths = rowPaths(["<li", "><a", "></a></li>"], [{}, {}], [0, 1]);
  assert.ok(paths);
  assert.equal(rowPaths(["<li>", "</li>"], [null], [0]), null);
});
