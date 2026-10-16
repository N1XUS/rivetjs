import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Brand",
  summary: 'Rivet addition: the brand gradient Button (`variant="brand"`) for the one primary call to action of a page.',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"].button--brand' }],
});
