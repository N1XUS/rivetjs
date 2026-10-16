import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Localized strings",
  summary: "getStringsForLocale matches a locale (exact, language-script, language, any region, default) and formatString fills {name} placeholders.",
  tags: ["cdk", "i18n", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#selected", "3 Elemente ausgewählt"] },
    { click: "#more" },
    { expect: ["#selected", "4 Elemente ausgewählt"] },
    { fill: ["#locale", "pt-PT"] },
    { expect: ["#selected", "4 itens selecionados"] },
    { fill: ["#locale", "sr-Latn-RS"] },
    { expect: ["#selected", "Izabrano stavki: 4"] },
    { fill: ["#locale", "he-IL"] },
    { attr: ["#selected", "dir", "rtl"] },
    { fill: ["#locale", "ja"] },
    { expect: ["#clear", "Clear selection"] },
    { attr: ["#selected", "dir", "ltr"] },
  ],
});
