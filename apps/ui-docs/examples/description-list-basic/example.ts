import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DescriptionList: Usage",
  summary: "An order summary: item rows, shipping, a separator and an emphasized total row in a secondary Surface.",
  tags: ["description-list", "surface"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#order-summary [data-slot=description-list-item][data-emphasized]", "Total$158"] }, { matches: "#order-summary dl > div > dt + dd" }],
});
