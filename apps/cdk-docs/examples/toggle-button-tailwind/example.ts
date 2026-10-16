import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton with Tailwind",
  summary: "ToggleButtons styled with Tailwind's aria-pressed: variant (or data-[selected]:), plus data-[pressed]: and focus-visible:.",
  tags: ["toggle-button", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-bold.rounded-md" },
    { click: "#tw-bold" },
    { attr: ["#tw-bold", "aria-pressed", "true"] },
    { press: ["#tw-italic", "Space"] },
    { attr: ["#tw-italic", "data-selected", "true"] },
  ],
});
