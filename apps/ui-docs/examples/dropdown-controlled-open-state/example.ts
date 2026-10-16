import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dropdown: Controlled Open State",
  summary: 'Dropdown demo "Controlled Open State".',
  tags: ["dropdown"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["strong", "closed"] }, { click: "button[aria-label=Menu]" }, { expect: ["strong", "open"] }],
});
