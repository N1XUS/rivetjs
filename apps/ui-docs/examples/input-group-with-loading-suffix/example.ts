import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Loading State",
  summary: 'InputGroup demo "Loading State".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-suffix] [data-slot=spinner]" }],
});
