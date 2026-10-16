import { test } from "vitest";
import assert from "node:assert/strict";
import { composeSlotClassName, composeTwRenderProps } from "../src/utils/compose.tsx";
import { cardVariants } from "../styles/src/index.ts";

test("composeSlotClassName: calls the slot with variants + class, falls back to class", () => {
  const s = cardVariants({ variant: "default" });
  assert.equal(composeSlotClassName(s.header, "x"), "card__header x");
  assert.equal(composeSlotClassName(undefined, "x"), "x");
  assert.equal(composeSlotClassName(undefined), undefined);
});

test("composeTwRenderProps: string + string, function + render props", () => {
  assert.equal(composeTwRenderProps("a", "b"), "b a");
  const fn = composeTwRenderProps<{ isSelected: boolean }>((v) => (v.isSelected ? "on" : "off"), "base") as (v: { isSelected: boolean }) => string;
  assert.equal(fn({ isSelected: true }), "base on");
});

test("composeTwRenderProps: tw function, empty inputs, accessor render props", () => {
  const tw = composeTwRenderProps<{ isSelected: boolean }>("x", (v) => (v.isSelected ? "on" : undefined)) as (v: { isSelected: boolean }) => string;
  assert.equal(tw({ isSelected: true }), "on x");
  assert.equal(tw({ isSelected: false }), "x");
  assert.equal(composeTwRenderProps(undefined, undefined), "");
  // cdk render props are accessors: the function form gets the object unchanged.
  const accessor = composeTwRenderProps<{ isSelected: () => boolean }>((v) => (v.isSelected() ? "sel" : ""), "base") as (v: {
    isSelected: () => boolean;
  }) => string;
  assert.equal(accessor({ isSelected: () => true }), "base sel");
  assert.equal(accessor({ isSelected: () => false }), "base");
});
