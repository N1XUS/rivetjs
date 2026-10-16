import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Required Field",
  summary: 'InputGroup demo "Required Field".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "required", ""] }],
});
