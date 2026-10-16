import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Markdown blog",
  summary: "Posts are Markdown files; the server parses them and renders the syntax tree as JSX, with no HTML strings.",
  tags: ["routing", "loaders", "params", "prerender"],
  mode: "server",
  show: ["src/posts.server.ts", "src/components/Markdown.tsx", "src/routes/blog/[slug].tsx"],
});
