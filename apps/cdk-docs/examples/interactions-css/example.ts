import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Interaction states with CSS",
  summary: "The same press, hover and focus-ring states styled by plain CSS attribute selectors, no Tailwind.",
  tags: ["cdk", "interactions", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#chip" },
    { matches: "#chip[data-hovered]" },
    { expect: ["#count", "1"] },
    { press: ["#before", "Tab"] },
    { matches: "#chip[data-focus-visible]" },
    { key: "Enter" },
    { expect: ["#count", "2"] },
  ],
});
