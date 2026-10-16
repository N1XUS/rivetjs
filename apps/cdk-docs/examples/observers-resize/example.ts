import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resize observers",
  summary: "useResizeObserver (React Aria) and sharedResizeObserver (Angular CDK) report size changes of an element from client effects.",
  tags: ["cdk", "observers", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#width", "Width: 120px"] },
    { expect: ["#entries", "Shared observer callbacks: 1"] },
    { click: "#toggle" },
    { expect: ["#width", "Width: 240px"] },
    { expect: ["#entries", "Shared observer callbacks: 2"] },
    { click: "#toggle" },
    { expect: ["#width", "Width: 120px"] },
  ],
});
