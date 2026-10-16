import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "I18nProvider",
  summary: "I18nProvider gives a subtree its locale and direction; useLocale() reads it and getDateFormatter() caches a formatter per locale and options.",
  tags: ["cdk", "i18n", "slots"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#inside", "Donnerstag, 15. Januar 2026"] },
    { attr: ["#inside", "dir", "ltr"] },
    { expect: ["#outside", "en-US"] },
    { click: "#set-ar-EG" },
    { attr: ["#inside", "dir", "rtl"] },
    { attr: ["#inside", "lang", "ar-EG"] },
    { click: "#set-ja-JP" },
    { expect: ["#inside", "2026年1月15日"] },
  ],
});
