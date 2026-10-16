// Ported from angular/components src/cdk/coercion/*.spec.ts (MIT, © Google LLC).
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import {
  coerceAccessor,
  coerceArray,
  coerceBooleanProperty,
  coerceCssPixelValue,
  coerceElement,
  coerceNumberProperty,
  coerceStringArray,
} from "../coercion/index.ts";

describe("coerceArray", () => {
  it("should wrap a string in an array", () => assert.deepEqual(coerceArray("just a string"), ["just a string"]));
  it("should wrap a number in an array", () => assert.deepEqual(coerceArray(42), [42]));
  it("should wrap an object in an array", () => {
    const objectVal = { something: "clever" };
    assert.deepEqual(coerceArray(objectVal), [objectVal]);
  });
  it("should wrap a null value in an array", () => assert.deepEqual(coerceArray(null), [null]));
  it("should wrap an undefined value in an array", () => assert.deepEqual(coerceArray(undefined), [undefined]));
  it("should not wrap an array in an array", () => {
    const arrayVal = [1, 2, 3];
    assert.equal(coerceArray(arrayVal), arrayVal);
  });
});

describe("coerceBooleanProperty", () => {
  const cases: [unknown, boolean, string][] = [
    [undefined, false, "undefined"],
    [null, false, "null"],
    ["", true, "the empty string"],
    [0, true, "zero"],
    ["false", false, 'the string "false"'],
    [false, false, "the boolean false"],
    [true, true, "the boolean true"],
    ["true", true, 'the string "true"'],
    ["pink", true, "an arbitrary string"],
    [{}, true, "an object"],
    [[], true, "an array"],
  ];
  for (const [value, expected, name] of cases) it(`should coerce ${name} to ${expected}`, () => assert.equal(coerceBooleanProperty(value), expected));
});

describe("coerceCssPixelValue", () => {
  it("should add pixel units to a number value", () => assert.equal(coerceCssPixelValue(1337), "1337px"));
  it("should ignore string values", () => assert.equal(coerceCssPixelValue("1337rem"), "1337rem"));
  it("should return an empty string for null", () => assert.equal(coerceCssPixelValue(null), ""));
  it("should return an empty string for undefined", () => assert.equal(coerceCssPixelValue(undefined), ""));
});

describe("coerceElement", () => {
  const element = { tagName: "BODY" };
  it("should coerce a ref (accessor) into an element", () => {
    const ref = signal<typeof element | undefined>(element);
    assert.equal(coerceElement(ref), element);
  });
  it("should return the element, if a native element is passed in", () => assert.equal(coerceElement(element), element));
});

describe("coerceNumberProperty", () => {
  const fallbackCases: [unknown, string][] = [
    [undefined, "undefined"],
    [null, "null"],
    [true, "true"],
    [false, "false"],
    ["", "the empty string"],
    ["pink", "an arbitrary string"],
    ["123pink", "an arbitrary string prefixed with a number"],
    [{}, "an object"],
    [[], "an array"],
  ];
  for (const [value, name] of fallbackCases)
    it(`should coerce ${name} to 0 or default`, () => {
      assert.equal(coerceNumberProperty(value), 0);
      assert.equal(coerceNumberProperty(value, 111), 111);
    });
  const numberCases: [unknown, number][] = [
    ["1", 1],
    ["123.456", 123.456],
    ["-123.456", -123.456],
    [1, 1],
    [123.456, 123.456],
    [-123.456, -123.456],
  ];
  for (const [value, expected] of numberCases)
    it(`should coerce ${typeof value} ${JSON.stringify(value)} to ${expected}`, () => {
      assert.equal(coerceNumberProperty(value), expected);
      assert.equal(coerceNumberProperty(value, 111), expected);
    });
});

describe("coerceStringArray", () => {
  it("should split a string", () => assert.deepEqual(coerceStringArray("x y  z 1"), ["x", "y", "z", "1"]));
  it("should map values to string in an array", () =>
    assert.deepEqual(coerceStringArray(["x", 1, true, null, undefined, ["arr", "ay"], { data: false }]), [
      "x",
      "1",
      "true",
      "null",
      "undefined",
      "arr,ay",
      "[object Object]",
    ]));
  it("should work with a custom delimiter", () => assert.deepEqual(coerceStringArray("1::2::3::4", "::"), ["1", "2", "3", "4"]));
  it("should trim values and remove empty values", () => assert.deepEqual(coerceStringArray(",  x,  ,, ", ","), ["x"]));
  it("should map non-string values to string", () => assert.deepEqual(coerceStringArray(0), ["0"]));
  it("should return an empty array for null", () => assert.deepEqual(coerceStringArray(null), []));
  it("should return an empty array for undefined", () => assert.deepEqual(coerceStringArray(undefined), []));
});

describe("coerceAccessor (coerceObservable)", () => {
  it("should return the accessor, if an accessor is passed in", () => {
    const s = signal(1);
    assert.equal(coerceAccessor(s), s);
  });
  it("should wrap non-accessors in accessors", () => assert.equal(coerceAccessor(3)(), 3));
});
