import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: events",
  summary: "`onSelectionChange`, `onInputChange` and `onOpenChange` logged as they fire.",
  tags: ["combobox", "events"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#city", "z"] },
    { expect: ["#log", "input: z"] },
    { expect: ["#log", "open: true"] },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#log", "selection: zur"] },
    { expect: ["#log", "open: false"] },
  ],
});
