import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip with Tailwind",
  summary:
    "Utilities in the Tooltip and OverlayArrow class, entering: / exiting: / placement-*: variants from @rivetjs/cdk/tailwind.css (skipped while moving between warm tooltips).",
  tags: ["tooltip", "tailwind", "transition"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { key: "Tab" },
    { focused: "#ttw-button" },
    { matches: "#ttw.rounded-md[data-placement=top]" },
    { matches: "#ttw > div.block[data-placement=top]" },
    { described: ["#ttw-button", "Copy to clipboard"] },
    { key: "Escape" },
    { absent: "#ttw" },
  ],
});
