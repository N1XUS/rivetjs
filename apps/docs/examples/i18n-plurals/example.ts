import { defineExample, type Step } from "@rivetjs/docs-kit/define.ts";

const plus = (times: number): Step[] => Array.from({ length: times }, () => ({ click: "#plus" }));

export default defineExample({
  title: "Plurals in two languages",
  summary: "A counter whose label comes from a plural message. English has two forms; Ukrainian has three (one, few, many).",
  tags: ["i18n", "plurals", "signals"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/[[lang]]/index.tsx", "locales/en.json", "locales/uk.json", "i18n.config.ts"],
  // Switching the language loads the other language's page, so the counter starts again at 0.
  test: [
    { expect: ["#count", "0 items"] },
    { click: "#plus" },
    { expect: ["#count", "1 item"] },
    { expect: ["#form", "one"] },
    { click: "#plus" },
    { expect: ["#count", "2 items"] },
    { expect: ["#form", "other"] },
    ...plus(3),
    { expect: ["#count", "5 items"] },
    { click: "#lang-uk" },
    { expect: ["#count", "0 товарів"] },
    { click: "#plus" },
    { expect: ["#count", "1 товар"] },
    { expect: ["#form", "one"] },
    { click: "#plus" },
    { expect: ["#count", "2 товари"] },
    { expect: ["#form", "few"] },
    ...plus(3),
    { expect: ["#count", "5 товарів"] },
    { expect: ["#form", "many"] },
    ...plus(6),
    { expect: ["#count", "11 товарів"] },
    { expect: ["#form", "many"] },
    ...plus(10),
    { expect: ["#count", "21 товар"] },
    { expect: ["#form", "one"] },
    { click: "#lang-en" },
    { expect: ["#count", "0 items"] },
  ],
});
