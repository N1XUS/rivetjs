import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatSource: Grouped",
  summary: "`ChatSources` collects the sources of an answer in a disclosure.",
  tags: ["chat-source"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: ".chat-sources__trigger" },
    { attr: [".chat-sources__trigger", "aria-expanded", "true"] },
    { expect: [".chat-sources__list", "design-notes.md"] },
  ],
});
