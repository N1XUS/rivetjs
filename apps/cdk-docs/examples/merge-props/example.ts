import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "mergeProps",
  summary: "pressProps, hoverProps and focusProps on one element: mergeProps chains their handlers (earlier first) and joins classes.",
  tags: ["cdk", "interactions"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#tile", "class", "tile tile--interactive"] },
    { click: "#tile" },
    { expect: ["#log", "hover:start focus press"] },
    { matches: "#tile[data-pressable]" },
    { click: "#away" },
    { expect: ["#log", "hover:start focus press hover:end blur"] },
  ],
});
