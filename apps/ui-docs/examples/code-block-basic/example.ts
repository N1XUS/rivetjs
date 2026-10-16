import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CodeBlock: Usage",
  summary: "Highlighted code with a language label and a copy button.",
  tags: ["code-block"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: [".code-block__language", "TSX"] }, { matches: ".code-block__token--keyword" }, { matches: "[aria-label='Copy code']" }],
});
