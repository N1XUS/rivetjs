import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HighContrastModeDetector",
  summary: "Detects Windows high-contrast (forced colors) mode and its theme, and applies the cdk-high-contrast-* body classes.",
  tags: ["cdk", "a11y", "angular-cdk"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ click: "#detect" }, { expect: ["#mode", "Mode: none"] }, { absent: "body.cdk-high-contrast-active" }],
});
