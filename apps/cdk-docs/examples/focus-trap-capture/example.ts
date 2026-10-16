import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CdkTrapFocus with autoCapture",
  summary: "The cdkTrapFocus directive as a class: attach() in a client effect focuses the initial element, destroy() on unmount restores the previous focus.",
  tags: ["cdk", "a11y", "angular-cdk", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/Panel.tsx", "src/routes/index.tsx"],
  test: [
    { press: ["#open", "Enter"] },
    { focused: "#name" },
    { key: "Tab" },
    { focused: "#close" },
    { key: "Tab" },
    { focused: "#name" },
    { press: ["#close", "Enter"] },
    { absent: "#name" },
    { focused: "#open" },
  ],
});
