import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BaseCollection and filtering",
  summary: "buildCollection from node specs (sections, separator, items) and BaseCollection.filter: empty sections and a trailing separator drop out.",
  tags: ["collections", "react-aria"],
  status: "experimental",
  frame: { height: 110, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#keys", "fruit[apple banana] sep veg[aubergine leek] (size 4)"] },
    { fill: ["#query", "a"] },
    { expect: ["#keys", "fruit[apple] sep veg[aubergine] (size 2)"] },
    { fill: ["#query", "le"] },
    { expect: ["#keys", "veg[leek] (size 1)"] },
    { fill: ["#query", "b"] },
    { expect: ["#keys", "fruit[banana] (size 1)"] },
  ],
});
