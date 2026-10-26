import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Shorthand",
  summary: "Rivet addition: `label` and `description` props instead of the Content / Control / Indicator parts and a Description.",
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { described: ["input[name=shorthand-mentions]", "Get notified"] },
    { click: "[data-slot=checkbox-content]" },
    { matches: "[data-slot=checkbox]:is([data-selected=true], :has(input:checked))" },
  ],
});
