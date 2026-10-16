import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "direction() and isRtlLocale()",
  summary:
    "direction(element) reads the nearest dir attribute, else the computed CSS direction; isRtlLocale tells right-to-left locales by script or language.",
  tags: ["cdk", "bidi", "basic"],
  status: "experimental",
  frame: { height: 202, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#page" },
    { expect: ["#read", "page: ltr"] },
    { click: "#hebrew" },
    { expect: ["#read", "hebrew: rtl"] },
    { click: "#css" },
    { expect: ["#read", "css: rtl"] },
    { expect: ["#locale-dir", "true"] },
    { fill: ["#locale", "de-DE"] },
    { expect: ["#locale-dir", 'isRtlLocale("de-DE"): false'] },
    { fill: ["#locale", "uz-Arab"] },
    { expect: ["#locale-dir", "true"] },
  ],
});
