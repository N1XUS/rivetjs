import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SwitchGroup: In a Fieldset",
  summary:
    "SwitchGroup inside a Fieldset whose Legend names the group (shorthand switches with descriptions, one disabled), and a horizontal SwitchGroup given role group and an aria-label.",
  tags: ["switch-group", "switch", "fieldset"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#sg-email input[name=digest]:checked" },
    { matches: "#sg-email input[name=billing]:disabled" },
    { click: "#sg-email [data-slot=switch]:has(input[name=mentions]) [data-slot=switch-content]" },
    { matches: "#sg-email input[name=mentions]:checked" },
    { attr: ["#sg-row", "data-slot", "switch-group"] },
    { name: ["#sg-row", "Editor options"] },
  ],
});
