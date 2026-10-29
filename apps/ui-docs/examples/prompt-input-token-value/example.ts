import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Token value",
  summary: "Segments as a two-way Signal: labels picked with # (queries with spaces), the token values read back, setValue restores the draft.",
  tags: ["prompt-input", "ai"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#labels-picked", "Labels: bug"] },
    { fill: ["#labels-text", "Triage this as #bug and assign it #needs r"] },
    { expect: ["[role=listbox]:not([hidden])", "needs review"] },
    { press: ["#labels-text", "Enter"] },
    { expect: ["#labels-picked", "Labels: bug, needs-review"] },
    { click: "#labels-reset" },
    { expect: ["#labels-picked", "Labels: bug"] },
  ],
});
