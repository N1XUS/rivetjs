import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup with plain CSS",
  summary:
    "A plain stylesheet for the default classes of a CheckboxGroup: rv-CheckboxGroup, rv-Label, rv-CheckboxField, rv-CheckboxButton, rv-Text and their data attributes.",
  tags: ["checkbox-group", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#css-cg.rv-CheckboxGroup > .rv-Label" },
    { matches: "#css-cg > .rv-Text" },
    { matches: "#css-cg > .rv-CheckboxField > .rv-CheckboxButton" },
    { click: "#css-cg label:has(input[value='b'])" },
    { matches: "#css-cg .rv-CheckboxButton[data-selected]:has(input[value='b'])" },
  ],
});
