import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs with Tailwind",
  summary: "Tailwind classes on each part; data-selected:, data-disabled:, data-hovered:, data-focus-visible: and orientation-vertical: variants.",
  tags: ["aria", "tabs", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw.grid > [role=tablist].flex" },
    { matches: "#tw-tab-account.data-selected\\:bg-indigo-600[data-selected]" },
    { press: ["#tw-tab-account", "ArrowRight"] },
    { attr: ["#tw-tab-team", "aria-selected", "true"] },
    { attr: ["#twv", "data-orientation", "vertical"] },
    { press: ["#twv-tab-account", "ArrowDown"] },
    { attr: ["#twv-tab-team", "aria-selected", "true"] },
  ],
});
