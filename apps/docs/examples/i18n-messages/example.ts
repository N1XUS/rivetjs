import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Messages in two languages",
  summary: "Messages with a parameter that reads a signal, tags inside a message, and keys chosen at runtime, in English and Ukrainian.",
  tags: ["i18n", "messages"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/[[lang]]/index.tsx", "locales/en.json", "locales/uk.json", "i18n.config.ts"],
  // Switching the language loads the other language's page, so the name starts again at "Ada".
  test: [
    { expect: ["#hello", "Hello, Ada!"] },
    { expect: ["#sections", "HomeShopHelp"] },
    { expect: ["#terms a", "terms"] },
    { expect: ["#terms b", "sent"] },
    { fill: ["#name", "Grace"] },
    { expect: ["#hello", "Hello, Grace!"] },
    { click: "#lang-uk" },
    { expect: ["#hello", "Привіт, Ada!"] },
    { expect: ["#sections", "ГоловнаМагазинДопомога"] },
    { expect: ["#terms a", "умови"] },
    { fill: ["#name", "Леся"] },
    { expect: ["#hello", "Привіт, Леся!"] },
  ],
});
