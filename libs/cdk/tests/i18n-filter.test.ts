// Rivet tests for the react-aria useFilter / useCollator / useListFormatter ports (upstream has no
// dedicated suites; behaviour is exercised there through ComboBox / Autocomplete / SelectValue tests).
import { describe, expect, it } from "vitest";
import { createFilter, getCollator } from "../i18n/filter.ts";
import { listFormatter } from "../i18n/list-formatter.ts";
import { cachedIntl } from "../i18n/intl-cache.ts";

describe("createFilter", () => {
  it("sensitivity base ignores case and accents", () => {
    const { contains, startsWith, endsWith } = createFilter({ sensitivity: "base" }, "en-US");
    expect(contains("Crème de cassis", "creme")).toBe(true);
    expect(contains("São Paulo", "sao")).toBe(true);
    expect(startsWith("Bogotá", "BOG")).toBe(true);
    expect(endsWith("Bogotá", "ota")).toBe(true);
    expect(contains("Apple", "pear")).toBe(false);
    expect(startsWith("Apple", "ple")).toBe(false);
  });

  it("empty substring matches everything", () => {
    const { contains, startsWith, endsWith } = createFilter({ sensitivity: "base" }, "en-US");
    expect(contains("", "")).toBe(true);
    expect(startsWith("abc", "")).toBe(true);
    expect(endsWith("abc", "")).toBe(true);
  });

  it("default sensitivity (variant) is case and accent sensitive", () => {
    const { contains } = createFilter(undefined, "en-US");
    expect(contains("Apple", "apple")).toBe(false);
    expect(contains("Apple", "App")).toBe(true);
    expect(contains("Crème", "Creme")).toBe(false);
  });

  it("normalizes composed and decomposed forms", () => {
    const { contains } = createFilter({ sensitivity: "base" }, "en-US");
    expect(contains("Crème", "crème")).toBe(true);
  });

  it("collators are cached per locale + options", () => {
    expect(getCollator("en-US", { usage: "search", sensitivity: "base" })).toBe(getCollator("en-US", { sensitivity: "base", usage: "search" }));
    expect(getCollator("en-US", { sensitivity: "base" })).not.toBe(getCollator("de-DE", { sensitivity: "base" }));
  });
});

describe("listFormatter", () => {
  it("formats conjunctions per locale", () => {
    expect(listFormatter("en-US").format(["Apple", "Banana", "Cherry"])).toBe("Apple, Banana, and Cherry");
    expect(listFormatter("en-US").format(["Apple", "Banana"])).toBe("Apple and Banana");
    expect(listFormatter("de-DE").format(["Apfel", "Birne"])).toBe("Apfel und Birne");
  });

  it("caches per locale + options", () => {
    expect(listFormatter("en-US", { type: "disjunction" })).toBe(listFormatter("en-US", { type: "disjunction" }));
    expect(listFormatter("en-US", { type: "disjunction" }).format(["A", "B"])).toBe("A or B");
  });
});

describe("cachedIntl", () => {
  it("returns one instance per constructor + locale + option entries", () => {
    const a = cachedIntl(Intl.NumberFormat, "en-US", { style: "currency", currency: "USD" });
    expect(cachedIntl(Intl.NumberFormat, "en-US", { currency: "USD", style: "currency" })).toBe(a);
    expect(cachedIntl(Intl.NumberFormat, "de-DE", { style: "currency", currency: "USD" })).not.toBe(a);
    expect(cachedIntl(Intl.NumberFormat, "en-US", { style: "currency", currency: "EUR" })).not.toBe(a);
    expect(cachedIntl(Intl.NumberFormat, "en-US")).toBe(cachedIntl(Intl.NumberFormat, "en-US", {}));
    expect(cachedIntl(Intl.PluralRules, "en-US")).toBeInstanceOf(Intl.PluralRules);
    expect(a.format(1234.5)).toBe("$1,234.50");
  });

  it("formats like a fresh instance", () => {
    expect(cachedIntl(Intl.PluralRules, "en-US", { type: "ordinal" }).select(2)).toBe("two");
    expect(cachedIntl(Intl.DisplayNames, "en-US", { type: "dateTimeField" }).of("month")).toBe(
      new Intl.DisplayNames("en-US", { type: "dateTimeField" }).of("month"),
    );
    expect(cachedIntl(Intl.DateTimeFormat, "en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 9)))).toBe("Fri");
  });
});
