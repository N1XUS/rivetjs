import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Disabled State",
  summary: 'InputGroup demo "Disabled State".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 184, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "disabled", ""] }],
});
