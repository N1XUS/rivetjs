import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 1: a page",
  summary: "One file in src/routes becomes the page at /. It is plain HTML with no browser code.",
  tags: ["tutorial", "routes"],
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["h1", "My reading list"] }, { expect: ["#books", "The Hobbit"] }],
});
