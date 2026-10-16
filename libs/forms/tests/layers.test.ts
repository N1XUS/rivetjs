// scope views, server-driven error mapping, field arrays.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { z } from "zod";
import { createForm, defineForm, errorId, fieldId, fieldIssues, issue, isInvalid, path, setIssues, touched } from "../index.ts";
import { scope, scopePath } from "../scope.ts";
import { fromBracketPath, fromPointer, issueRecord, mapIssues } from "../errors.ts";
import { insert, insertIntent, keys, move, remove, removeIntent, rows, swap } from "../array.ts";
import { runtime } from "../store.ts";
import { encodeState } from "./fixtures.ts";

const address = z.object({ city: z.string().min(1), zip: z.string() });
const checkout = defineForm({ name: "checkout", schema: z.object({ billing: address, shipping: address, items: z.array(z.object({ sku: z.string(), qty: z.number() })) }) });

test("scope(): names, ids and issues relative to the path; one store", () => {
  const form = createForm(checkout);
  const billing = scope(form, "billing");
  const shipping = scope(form, "shipping");
  assert.equal(path(billing, "city"), "billing.city");
  assert.equal(fieldId(shipping, "city"), "checkout-shipping-city");
  assert.equal(errorId(billing, "zip"), "checkout-billing-zip-error");
  assert.equal(scopePath(billing), "billing");
  setIssues(billing, { city: "errors.required" });
  assert.deepEqual(issue(form, "billing.city"), { key: "errors.required" });
  assert.equal(isInvalid(billing), true);
  assert.equal(isInvalid(shipping), undefined);
  assert.deepEqual(fieldIssues(billing), [["city", [{ key: "errors.required" }]]]);
  // Views of views nest; the view serializes as a plain pair.
  const row = scope(scope(form, "items"), "0" as never) as never;
  assert.equal(path(row, "sku" as never), "items.0.sku");
  assert.doesNotThrow(() => encodeState({ form, billing }));
});

test("mapIssues(): unwrap → field issues, unknown paths → form-level; pointer and bracket helpers", () => {
  type Backend = { errors: { pointer: string; code: string; detail?: string }[] };
  const reply: Backend = {
    errors: [
      { pointer: "/billing/city", code: "errors.city" },
      { pointer: "/items/1/qty", code: "errors.qty" },
      { pointer: "/internal/id", code: "errors.internal", detail: "Bad id" },
      { pointer: "", code: "errors.global" },
    ],
  };
  const mapped = mapIssues(reply, (r) => r.errors.map((e) => ({ path: fromPointer(e.pointer), key: e.code, message: e.detail })), { known: ["billing.city", "items.$.qty"] });
  assert.deepEqual(mapped, [
    { path: "billing.city", key: "errors.city" },
    { path: "items.1.qty", key: "errors.qty" },
    { path: "", key: "errors.internal", message: "Bad id" },
    { path: "", key: "errors.global" },
  ]);
  assert.deepEqual(issueRecord(mapped)[""], [{ key: "errors.internal", message: "Bad id" }, { key: "errors.global" }]);
  assert.equal(fromPointer("/a~1b/0/c~0d"), "a/b.0.c~d");
  assert.equal(fromBracketPath("items[0].sku"), "items.0.sku");
  assert.equal(fromBracketPath('user["name"]'), "user.name");
  assert.equal(fromBracketPath("a[__proto__]"), "");
  // Prototype paths never become keys.
  assert.deepEqual(mapIssues(null, () => [{ path: ["__proto__", "x"], key: "k" }]), [{ path: "", key: "k" }]);
  const form = createForm(checkout);
  setIssues(form, issueRecord(mapped) as never);
  assert.deepEqual(issue(form, "items.1.qty"), { key: "errors.qty" });
});

test("arrays: keys from initial/echo, records move with rows, intents", () => {
  const form = createForm(checkout, { initial: { items: [{ sku: "a" }, { sku: "b" }, { sku: "c" }] } });
  assert.deepEqual(keys(form, "items"), ["0", "1", "2"]);
  setIssues(form, { "items.1.sku": "errors.b", "items.2.sku": "errors.c" });
  form.t = {};
  remove(form, "items", 0);
  assert.equal(rows(form, "items"), 2);
  assert.deepEqual(keys(form, "items"), ["1", "2"]);
  assert.deepEqual(issue(form, "items.0.sku"), { key: "errors.b" });
  assert.deepEqual(issue(form, "items.1.sku"), { key: "errors.c" });
  assert.equal(issue(form, "items.2.sku"), undefined);
  assert.equal(runtime(form).armed.has("items.2.sku"), false);
  insert(form, "items", 0);
  const [fresh] = keys(form, "items");
  assert.equal(keys(form, "items").length, 3);
  assert.ok(!["1", "2"].includes(fresh!));
  assert.equal(issue(form, "items.0.sku"), undefined);
  assert.deepEqual(issue(form, "items.1.sku"), { key: "errors.b" });
  swap(form, "items", 1, 2);
  assert.deepEqual(issue(form, "items.1.sku"), { key: "errors.c" });
  move(form, "items", 2, 0);
  assert.deepEqual(untrack(form.k!["items"]!).slice(0, 1), ["1"]);
  assert.deepEqual(issue(form, "items.0.sku"), { key: "errors.b" });
  assert.equal(touched(form, "items.0.sku"), false);
  // Echo after a no-JS intent: the `#path` row count wins (empty rows are not in values).
  const echoed = createForm(checkout, { result: { name: "checkout", result: { ok: false, intent: "insert:items", values: { "items.0.sku": "a" }, rows: { items: 2 } } } });
  assert.equal(rows(echoed, "items"), 2);
  assert.equal(insertIntent("items"), "insert:items");
  assert.equal(removeIntent("items", 1), "remove:items:1");
});
