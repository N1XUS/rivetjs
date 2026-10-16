import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Header",
  summary: "Header as the title of a group of options.",
  tags: ["header"],
  status: "experimental",
  frame: { height: 201, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "header#recent.header[data-slot=header]",
    },
  ],
});
