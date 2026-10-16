import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "mergeProps()",
  summary:
    "mergeProps joins classes and chains handlers (one implementation for attribute bags and handler bags); chain and mergeRefs combine callbacks and refs.",
  tags: ["cdk", "utils", "basic", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#save", "class", "rounded-md border px-3 py-1 border-teal-700 text-teal-800"] },
    { attr: ["#save", "aria-describedby", "hint status"] },
    { attr: ["#save", "data-size", "lg"] },
    { described: ["#save", "Saves the draft."] },
    { click: "#save" },
    { expect: ["#log li:nth-child(1)", "first"] },
    { expect: ["#log li:nth-child(2)", "second"] },
    { expect: ["#log li:nth-child(3)", "chain 1"] },
    { expect: ["#log li:nth-child(4)", "chain 2"] },
    { expect: ["#log li:nth-child(5)", 'class "a b", refs node/node'] },
  ],
});
