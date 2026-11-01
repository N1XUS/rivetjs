// The public entry outside a compiled app: an uncompiled t() and locale() outside a request say how to fix it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { locale, t } from "../index.ts";

test("t() and t.in() without the i18n() plugin throw a setup error", () => {
  const translate = t as unknown as ((key: string) => string) & { in: (locale: string, key: string) => string };
  assert.throws(() => translate("cart.title"), /t\(\) was not compiled\. Add i18n\(\) before rivet\(\)/);
  assert.throws(() => translate.in("de", "cart.title"), /t\(\) was not compiled/);
});

test("locale() outside a page render throws", () => {
  assert.throws(() => locale(), /locale\(\) has no request locale/);
});
