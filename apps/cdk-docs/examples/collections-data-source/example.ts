import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataSource and UniqueSelectionDispatcher",
  summary: "ArrayDataSource over a signal (connect returns an accessor), isDataSource, and a UniqueSelectionDispatcher telling the other items to uncheck.",
  tags: ["collections", "angular-cdk"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#names", "AdaAlan"] },
    { expect: ["#is-source", "isDataSource(source): true, isDataSource([]): false"] },
    { click: "#add" },
    { expect: ["#names li:nth-child(3)", "Grace"] },
    { click: "#pick-b" },
    { expect: ["#dispatch", "checked b; notified to uncheck: a, c"] },
    { click: "#pick-c" },
    { expect: ["#dispatch", "checked c; notified to uncheck: a, b"] },
  ],
});
