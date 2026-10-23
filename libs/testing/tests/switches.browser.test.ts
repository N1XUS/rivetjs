// `rivetTest()` serves the runtime switch modules like a default resumable app build (root `vitest.config.ts` browser
// projects run with it): the derived adopt run switches on, DOM data off.
import { expect, test } from "vitest";
import { DERIVED } from "../../runtime/derived.ts";
import { LAZY_ROWS } from "../../runtime/lazy-rows.ts";
import { DOM_DATA } from "../../runtime/dom-data.ts";

test("runtime switches in a rivetTest() browser project: derived + lazy-rows on, domData off", () => {
  expect([DERIVED, LAZY_ROWS, DOM_DATA]).toEqual([true, true, false]);
});
