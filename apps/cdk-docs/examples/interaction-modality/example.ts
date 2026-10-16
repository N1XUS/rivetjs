import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Interaction modality",
  summary: "createInteractionModality() and createFocusVisible() as signals: keyboard, pointer or virtual, and whether focus rings should show.",
  tags: ["cdk", "focus", "a11y"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#target" },
    { expect: ["#modality", "pointer"] },
    { expect: ["#visible", "false"] },
    { press: ["#target", "Tab"] },
    { expect: ["#modality", "keyboard"] },
    { expect: ["#visible", "true"] },
    { click: "#virtual" },
    { expect: ["#modality", "virtual"] },
  ],
});
