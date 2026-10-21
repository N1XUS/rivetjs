// Rivet tests: `isRTL`'s left-to-right fast path (DERIVED-C2: no likely-subtags lookup for languages written left to
// right in every script and region) answers what the full `Intl.Locale#maximize` lookup answers, for the language
// alone and with regions whose likely script differs elsewhere (pa-PK, az-IR, uz-AF are right to left).
import { describe, expect, it, vi } from "vitest";
import { getDefaultLocale, isRTL } from "../i18n/index.ts";

type Maximized = Intl.Locale & { getTextInfo?: () => { direction: string }; textInfo?: { direction: string } };
const full = (tag: string): boolean => {
  const locale = new Intl.Locale(tag).maximize() as Maximized;
  const info = typeof locale.getTextInfo === "function" ? locale.getTextInfo() : locale.textInfo;
  return info ? info.direction === "rtl" : false;
};
const LANGS = ["bg", "ca", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv"];
const MORE = ["nb", "nl", "nn", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "th", "tr", "uk", "vi", "zh"];
const REGIONS = ["", "-US", "-GB", "-PK", "-IR", "-AF", "-IL", "-EG", "-SA", "-CN", "-TW", "-419"];

describe("isRTL", () => {
  it("fast-path languages answer the maximize lookup in every region", () => {
    for (const lang of [...LANGS, ...MORE]) for (const region of REGIONS) expect(isRTL(lang + region), lang + region).toBe(full(lang + region));
  });
  it("a right-to-left script subtag wins over the language", () => {
    expect(isRTL("en-Arab")).toBe(true);
    expect(isRTL("en-Latn-US")).toBe(false);
  });
  it("other languages still go through the lookup", () => {
    for (const tag of ["ar", "he-IL", "fa", "pa-PK", "pa-IN", "az-IR", "az", "uz-AF", "ur", "ms-Arab"]) expect(isRTL(tag), tag).toBe(full(tag));
  });
});

describe("getDefaultLocale", () => {
  it("a malformed environment locale falls back to en-US", () => {
    const root = { lang: "not a tag" };
    vi.stubGlobal("document", { documentElement: root });
    try {
      expect(getDefaultLocale()).toEqual({ locale: "en-US", direction: "ltr" });
      root.lang = "he-IL";
      expect(getDefaultLocale()).toEqual({ locale: "he-IL", direction: "rtl" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
