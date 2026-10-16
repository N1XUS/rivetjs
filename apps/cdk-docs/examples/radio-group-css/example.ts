import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup with plain CSS",
  summary: "A plain stylesheet for the default classes of a RadioGroup: rv-RadioGroup, rv-Label, rv-Radio, rv-Text and their data attributes.",
  tags: ["radio-group", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#css-rg.rv-RadioGroup > .rv-Label" },
    { click: "#css-rg input[value='dark']" },
    { matches: "#css-rg .rv-Radio[data-selected]:has(input[value='dark'])" },
  ],
});
