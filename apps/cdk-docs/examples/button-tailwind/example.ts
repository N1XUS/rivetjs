import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button with Tailwind",
  summary: "Buttons styled with Tailwind utilities on class and state variants: data-[pressed], data-[pending], disabled and focus-visible.",
  tags: ["button", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-primary.bg-teal-700" },
    { absent: "#tw-primary.rv-Button" },
    { click: "#tw-primary" },
    { expect: ["#tw-count", "1"] },
    { attr: ["#tw-off", "data-disabled", "true"] },
  ],
});
