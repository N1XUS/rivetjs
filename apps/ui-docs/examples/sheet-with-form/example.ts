import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: With Form",
  summary: "A form in a sheet: the submit button closes it and shows the saved value.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { fill: ["[data-slot=sheet-body] input", "Atlas Labs"] },
    { click: "#sheet-form-save" },
    { absent: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-form-saved", "Atlas Labs"] },
  ],
});
