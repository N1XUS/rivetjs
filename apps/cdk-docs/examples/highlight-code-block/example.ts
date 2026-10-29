import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Code block from tokens",
  summary:
    "highlight() splits TypeScript and CSS into typed tokens on the server; each non-plain token becomes a span with a tok-<type> class, and languageLabel names the block.",
  tags: ["highlight", "code"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#hl-ts figcaption", "TypeScript"] },
    { expect: ["#hl-ts .tok-keyword", "const"] },
    { expect: ["#hl-ts .tok-comment", "// count"] },
    { expect: ["#hl-css figcaption", "CSS"] },
    { expect: ["#hl-ts code", "export function label(n: number)"] },
  ],
});
