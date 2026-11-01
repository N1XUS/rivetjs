import { test } from "vitest";
import assert from "node:assert/strict";
import { date, number, pick, plural, select } from "../runtime.ts";

const items = { "=0": () => "none", one: () => "one item", other: () => "many items" };
test("plural exact match wins over category", () => {
  assert.equal(plural("en", 0, items), "none");
  assert.equal(plural("en", 1, items), "one item");
  assert.equal(plural("en", 5, items), "many items");
});
test("plural uses locale rules (pl few)", () => {
  assert.equal(plural("pl", 3, { few: () => "few", other: () => "other" }), "few");
});
test("plural falls back to other for an absent category", () => {
  assert.equal(plural("pl", 3, { other: () => "other" }), "other");
});
test("ordinal", () => {
  assert.equal(plural("en", 2, { two: () => "nd", other: () => "th" }, true), "nd");
  assert.equal(plural("en", 4, { two: () => "nd", other: () => "th" }, true), "th");
});
test("select falls back to other", () => {
  assert.equal(select("f", { f: () => "she", other: () => "they" }), "she");
  assert.equal(select("x", { f: () => "she", other: () => "they" }), "they");
  assert.equal(select("toString", { other: () => "they" }), "they");
});
test("number/date format per locale", () => {
  assert.equal(number("de", 1234.5), "1.234,5");
  assert.equal(number("en", 0.25, { style: "percent" }), "25%");
  assert.equal(date("en", Date.UTC(2026, 0, 2), { dateStyle: "short" }, "UTC"), "1/2/26");
  assert.equal(date("de", new Date(Date.UTC(2026, 0, 2)), { dateStyle: "short" }, "UTC"), "02.01.26");
});
test("pick indexes by locale, defaulting to first", () => {
  assert.equal(pick("de", ["en", "de"], [() => "Hi", () => "Hallo"]), "Hallo");
  assert.equal(pick("fr", ["en", "de"], [() => "Hi", () => "Hallo"]), "Hi");
});

test("plural: locales with zero / two / few / many categories, fractional, negative and NaN counts", () => {
  const all = { zero: () => "zero", one: () => "one", two: () => "two", few: () => "few", many: () => "many", other: () => "other" };
  assert.deepEqual(
    [0, 1, 2, 3, 11, 100].map((n) => plural("ar", n, all)),
    ["zero", "one", "two", "few", "many", "other"],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 6, 4].map((n) => plural("cy", n, all)),
    ["zero", "one", "two", "few", "many", "other"],
  );
  assert.equal(plural("en", 1.5, all), "other");
  assert.equal(plural("en", -1, all), "one");
  assert.equal(plural("en", Number.NaN, all), "other");
  // A category the message does not list falls back to other.
  assert.equal(plural("ar", 3, { other: () => "other" }), "other");
  assert.deepEqual(
    [1, 2, 3, 4, 11, 22].map((n) => plural("en", n, all, true)),
    ["one", "two", "few", "other", "other", "two"],
  );
});
