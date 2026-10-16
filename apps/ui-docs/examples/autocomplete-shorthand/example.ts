import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete: Shorthand",
  summary: "Rivet addition: `label` / `items` render the trigger, popover, search field and filtered list; `Autocomplete.Item` adds the indicator.",
  tags: ["autocomplete"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=autocomplete-trigger]" },
    { fill: ["[data-slot=autocomplete-popover] input", "zur"] },
    { click: "[role=option][data-key=zurich]" },
    { expect: ["[data-slot=autocomplete-value]", "Zürich"] },
  ],
});
