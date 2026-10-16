import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "keyboardProps",
  summary: "Keydown and keyup handlers whose events stop at the element unless the handler calls continuePropagation(); isDisabled switches them off.",
  tags: ["cdk", "interactions", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#note", "a"] },
    { expect: ["#log", "down:a up:a"] },
    // Stopped at the input: the form's own keydown listener saw nothing.
    { expect: ["#parent", "Form saw 0 keys"] },
    { key: "ArrowDown" },
    { expect: ["#parent", "Form saw 1 keys"] },
    { click: "#off" },
    { press: ["#note", "b"] },
    { expect: ["#log", "down:a up:a down:ArrowDown up:ArrowDown"] },
    { expect: ["#parent", "Form saw 2 keys"] },
  ],
});
