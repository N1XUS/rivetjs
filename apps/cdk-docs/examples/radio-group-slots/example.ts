import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup content and descriptions",
  summary:
    "The children render function of a RadioGroup renders each radio's content; item descriptions and a group description are linked with aria-describedby.",
  tags: ["radio-group", "slots"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["label:has(#speed-fast)", "Express"] },
    { expect: ["label:has(#speed-fast)", "€9"] },
    { described: ["#speed-fast", "Next working day."] },
    { described: ["#speed-fast", "Prices include VAT."] },
    { described: ["#speeds", "Prices include VAT."] },
    { click: "#speed-fast" },
    { matches: "label[data-selected]:has(#speed-fast)" },
  ],
});
