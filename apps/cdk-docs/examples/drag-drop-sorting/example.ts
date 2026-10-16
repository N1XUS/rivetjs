import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: sortable list",
  summary: "Port of the Angular CDK sorting example: a DropList of movies; onDropped moves the item with moveItemInArray and the keyed For follows.",
  tags: ["cdk", "drag-drop", "sorting"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#movies.cdk-drop-list > #movie-0.cdk-drag:first-child" },
    { attr: ["#movies", "data-orientation", "vertical"] },
    { matches: "#movies > #movie-8:last-child" },
  ],
});
