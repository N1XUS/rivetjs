import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ActiveDescendantKeyManager",
  summary: "Focus stays on the input; the ActiveDescendantKeyManager moves aria-activedescendant and the active styles through the options.",
  tags: ["cdk", "a11y", "angular-cdk", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#city", "ArrowDown"] },
    { attr: ["#city", "aria-activedescendant", "opt-berlin"] },
    { matches: "#opt-berlin[data-active]" },
    { key: "ArrowDown" },
    { attr: ["#city", "aria-activedescendant", "opt-lisbon"] },
    { absent: "#opt-berlin[data-active]" },
    { focused: "#city" },
    { key: "ArrowUp" },
    { attr: ["#city", "aria-activedescendant", "opt-berlin"] },
    { key: "Enter" },
    { expect: ["#chosen", "Chosen: Berlin"] },
  ],
});
