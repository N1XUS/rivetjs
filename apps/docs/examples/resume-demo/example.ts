import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resume demo",
  summary: "Nothing runs in the browser before the first click. The render time is kept in a signal, so it stays the server's value when the browser picks the component up.",
  tags: ["resume", "signals"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#count", "Count: 0"] },
    { click: "#add" },
    { expect: ["#count", "Count: 1"] },
    { click: "#add" },
    { expect: ["#count", "Count: 2"] },
    { expect: ["#rendered", "Component rendered at"] },
  ],
});
