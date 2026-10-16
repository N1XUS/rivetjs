import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 2: components and props",
  summary: "A BookCard component used three times, each time with different props.",
  tags: ["tutorial", "components"],
  frame: { height: "md" },
  show: ["src/components/BookCard.tsx", "src/routes/index.tsx"],
  test: [{ expect: ["#books", "Frank Herbert"] }],
});
