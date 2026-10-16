import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs with custom elements",
  summary: "The render prop puts the tablist on a ul and each tab on an li: the parts keep their ARIA, keyboard and selection.",
  tags: ["aria", "tabs", "behaviour"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "ul#wind-tablist[role=tablist] > li#wind-tab-north[role=tab]" },
    { attr: ["#wind-tab-north", "aria-selected", "true"] },
    { absent: "#wind-tabpanel-south" },
    { press: ["#wind-tab-north", "ArrowRight"] },
    { focused: "#wind-tab-south" },
    { expect: ["#value", "Selected: south"] },
    { expect: ["#wind-tabpanel-south", "Wind from the south."] },
    { click: "#wind-tab-east" },
    { expect: ["#value", "Selected: east"] },
    { attr: ["#wind-tab-east", "tabindex", "0"] },
  ],
});
