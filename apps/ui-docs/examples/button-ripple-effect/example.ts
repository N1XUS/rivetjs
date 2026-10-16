import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Adding Ripple Effect",
  summary: 'Button demo "Adding Ripple Effect"; partly not yet ported (see the note in the code).',
  tags: ["button", "not-yet-ported"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
