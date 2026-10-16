import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusKeyManager",
  summary: "Roving focus over a list with the Angular CDK FocusKeyManager: arrows with wrap, Home/End, typeahead, disabled items skipped, change events.",
  tags: ["cdk", "a11y", "angular-cdk", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#apple", "ArrowDown"] },
    { focused: "#banana" },
    // Cherry is disabled: skipped.
    { key: "ArrowDown" },
    { focused: "#date" },
    { key: "ArrowDown" },
    { focused: "#apple" },
    { key: "End" },
    { focused: "#date" },
    { key: "Home" },
    { focused: "#apple" },
    { key: "b" },
    { focused: "#banana" },
    { expect: ["#active", "Active index: 1"] },
  ],
});
