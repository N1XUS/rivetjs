import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Markdown renderer",
  summary:
    "parseMarkdown turns a Markdown string into plain-data blocks; a small renderer maps them to semantic elements, renders code as text and drops links whose scheme safeUrl rejects.",
  tags: ["markdown"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#md h2", "Release notes"] },
    { expect: ["#md strong", "ready"] },
    { matches: "#md li input[type=checkbox][checked]" },
    { attr: ["#md a", "href", "/changelog"] },
    { absent: "#md a[href^=javascript]" },
    { expect: ["#md pre[data-lang=ts] code", "const total = rows.length;"] },
  ],
});
