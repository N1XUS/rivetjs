import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Coercion",
  summary: "Every @rivetjs/cdk/coercion function applied to one input value: booleans, numbers with fallbacks, CSS pixels, string arrays, arrays, accessors.",
  tags: ["cdk", "coercion", "basic"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#row-0 td", "false"] },
    { expect: ["#row-2 td", '"n/a"'] },
    { fill: ["#value", ""] },
    { expect: ["#row-0 td", "true"] },
    { expect: ["#row-5 td", "[]"] },
    { fill: ["#value", "12"] },
    { expect: ["#row-1 td", "12"] },
    { expect: ["#row-3 td", '"12"'] },
    { expect: ["#row-4 td", '"12px"'] },
    { fill: ["#value", " a, b ,,c "] },
    { expect: ["#row-5 td", '["a,","b",",,c"]'] },
    { expect: ["#row-6 td", '["a","b","c"]'] },
    { expect: ["#row-7 td", '[" a, b ,,c "]'] },
    { fill: ["#value", "12px"] },
    { expect: ["#row-1 td", "0"] },
  ],
});
