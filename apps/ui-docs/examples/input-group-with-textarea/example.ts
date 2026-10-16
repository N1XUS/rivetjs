import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: With TextArea",
  summary: 'InputGroup demo "With TextArea"; partly not yet ported (see the note in the code).',
  tags: ["input-group", "not-yet-ported"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "textarea[data-slot=input-group-textarea]" },
    { fill: ["textarea", "Hi"] },
    { click: "button[aria-label='Send prompt']" },
    { matches: "button[aria-label='Send prompt'] [data-slot=spinner]" },
  ],
});
