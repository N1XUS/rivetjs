// Queries and migrations on an in-memory database.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  allTags,
  countBookmarks,
  createBookmark,
  deleteBookmark,
  exportBookmarks,
  getBookmark,
  importBookmarks,
  listBookmarks,
  openDb,
  parseInput,
  seedBookmarks,
  updateBookmark,
} from "../src/server/db.server.ts";

const migrations = fileURLToPath(new URL("../migrations", import.meta.url));
const fresh = () => openDb(":memory:", migrations);
const input = (n: number, tags: string[] = []) => ({ title: `t${n}`, url: `https://e.com/${n}`, tags });

test("migrations apply once", () => {
  const db = fresh();
  assert.equal(countBookmarks(db), 0);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM _migrations").get() as { n: number }).n, 1);
});

test("keyset pagination walks every row once, newest first", () => {
  const db = fresh();
  seedBookmarks(db, 45);
  const seen: number[] = [];
  let before: number | undefined;
  for (;;) {
    const page = listBookmarks(db, { limit: 20, before });
    seen.push(...page.items.map((b) => b.id));
    if (page.next === null) break;
    before = page.next;
  }
  assert.equal(seen.length, 45);
  assert.deepEqual(
    seen,
    [...seen].sort((a, b) => b - a),
  );
});

test("search and tag filter combine; LIKE wildcards are literal", () => {
  const db = fresh();
  createBookmark(db, { title: "Rust book", url: "https://rust.dev", tags: ["rust", "book"] });
  createBookmark(db, { title: "100% css", url: "https://css.dev", tags: ["css"] });
  assert.equal(listBookmarks(db, { q: "rust" }).items.length, 1);
  assert.equal(listBookmarks(db, { tag: "book" }).items.length, 1);
  assert.equal(listBookmarks(db, { q: "rust", tag: "css" }).items.length, 0);
  assert.equal(listBookmarks(db, { q: "%" }).items.length, 1);
  assert.equal(listBookmarks(db, { tag: "boo" }).items.length, 0);
  assert.deepEqual(allTags(db), ["book", "css", "rust"]);
});

test("update, delete, get", () => {
  const db = fresh();
  const id = createBookmark(db, input(1, ["a"]));
  assert.ok(updateBookmark(db, id, input(2, ["b", "c"])));
  assert.deepEqual(getBookmark(db, id)?.tags, ["b", "c"]);
  assert.ok(deleteBookmark(db, id));
  assert.equal(getBookmark(db, id), null);
  assert.equal(deleteBookmark(db, id), false);
});

test("validation", () => {
  assert.deepEqual(parseInput({ title: " ", url: "nope" }), { ok: false, issues: { title: "Title is required", url: "Enter a valid URL" } });
  assert.equal(parseInput({ title: "a", url: "javascript:alert(1)" }).ok, false);
  const ok = parseInput({ title: "a", url: "https://x.dev", tags: "Foo, foo  bar" });
  assert.ok(ok.ok && ok.value.tags.join() === "foo,bar");
});

test("import is all or nothing; export round-trips; seed is deterministic", () => {
  const db = fresh();
  assert.deepEqual(importBookmarks(db, [input(1), { title: "", url: "x" }]), { error: "Item 1: Title is required, Enter a valid URL" });
  assert.equal(countBookmarks(db), 0);
  assert.deepEqual(importBookmarks(db, [input(1, ["a"]), input(2)]), { added: 2 });
  assert.deepEqual(exportBookmarks(db), [input(1, ["a"]), input(2)]);
  assert.deepEqual(importBookmarks(db, "x"), { error: "Expected a JSON array" });
  const a = fresh();
  const b = fresh();
  seedBookmarks(a);
  seedBookmarks(b);
  assert.equal(countBookmarks(a), 500);
  assert.deepEqual(exportBookmarks(a), exportBookmarks(b));
});
