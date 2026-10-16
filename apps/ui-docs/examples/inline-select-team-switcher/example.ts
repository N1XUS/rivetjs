import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Team Switcher",
  summary: "A workspace switcher in an app header: an avatar and the team name that opens a list.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".inline-select__value", "Acme Inc."] },
    { click: "[data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=globex]" },
    { expect: [".inline-select__value", "Globex"] },
  ],
});
