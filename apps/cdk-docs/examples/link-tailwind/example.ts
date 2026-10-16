import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link with Tailwind",
  summary: "Links styled with Tailwind: hover:, focus-visible:, data-[current]: (aria-current:), data-[disabled]: and data-[pressed]:.",
  tags: ["link", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#tw-l-home.underline-offset-4" }, { attr: ["#tw-l-home", "data-current", "true"] }, { matches: "#tw-l-off[data-disabled]" }],
});
