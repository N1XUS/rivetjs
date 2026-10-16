import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Counter",
  summary: "A button that counts. The server renders it; the browser loads the click code when you first use it.",
  tags: ["signals", "events", "resume"],
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#count", "Clicked 0 times"] }, { click: "#count" }, { expect: ["#count", "Clicked 1 time"] }, { click: "#count" }, { expect: ["#count", "Clicked 2 times"] }],
});
