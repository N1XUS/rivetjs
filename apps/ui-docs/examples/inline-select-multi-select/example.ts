import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Multi Select",
  summary: 'selectionMode="multiple": the list stays open while you pick, and the value lists the picks.',
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=inline-select-trigger]" }, { click: "[role=option][data-key=push]" }, { expect: [".inline-select__value", "Email and Push"] }],
});
