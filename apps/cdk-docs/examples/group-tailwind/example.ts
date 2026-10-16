import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group with Tailwind",
  summary: "An input group styled with Tailwind: data-[focus-within]:, data-[focus-visible]:, data-[invalid]: and data-[disabled]: on the Group.",
  tags: ["group", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-price.rounded-md" },
    { click: "#tw-price-input" },
    { attr: ["#tw-price", "data-focus-within", "true"] },
    { matches: "#tw-price-bad[data-invalid]" },
  ],
});
