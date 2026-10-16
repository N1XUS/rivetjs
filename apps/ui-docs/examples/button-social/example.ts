import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Social Buttons",
  summary: 'Button demo "Social Buttons"; partly not yet ported (see the note in the code).',
  tags: ["button", "not-yet-ported"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
