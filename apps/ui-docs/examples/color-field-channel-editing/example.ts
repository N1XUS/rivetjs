import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Channel Editing",
  summary: 'ColorField demo "Channel Editing".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["span.text-sm:not(.text-muted)", "Current: #7F007F"] },
    { fill: ["[data-slot=color-input-group-input] >> nth=0", "120"] },
    { key: "Tab" },
    { expect: ["span.text-sm:not(.text-muted)", "Current: #007F00"] },
  ],
});
