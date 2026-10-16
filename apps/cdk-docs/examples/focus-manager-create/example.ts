import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "createFocusManager",
  summary: "A focus manager over any element (no FocusScope): next and previous with wrap, tabbable only, and an accept filter.",
  tags: ["cdk", "focus", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#c1", "ArrowRight"] },
    { focused: "#c2" },
    // c3 is archived: the accept filter skips it.
    { key: "ArrowRight" },
    { focused: "#c4" },
    { key: "ArrowRight" },
    { focused: "#c1" },
    { key: "ArrowLeft" },
    { focused: "#c4" },
  ],
});
