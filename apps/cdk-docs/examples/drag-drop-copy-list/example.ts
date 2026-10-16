import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: copying items between lists",
  summary:
    "Port of the Angular CDK copy list example: hasAnchor + sortingDisabled on the products list; a drop into the cart copies the product (copyArrayItem).",
  tags: ["cdk", "drag-drop", "connected"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ expect: ["#products", "Bread"] }, { expect: ["#cart", "Tomatoes"] }],
});
