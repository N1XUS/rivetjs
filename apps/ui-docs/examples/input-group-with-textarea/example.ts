import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: With TextArea",
  summary: 'InputGroup demo "With TextArea".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "textarea[data-slot=input-group-textarea]" },
    { matches: "button[aria-label='Send prompt'][disabled]" },
    { fill: ["textarea", "Hi"] },
    { matches: "button[aria-label='Send prompt']:not([disabled])" },
    { click: "button[aria-label='Send prompt']" },
    { matches: "button[aria-label='Send prompt'] [data-slot=spinner]" },
  ],
});
