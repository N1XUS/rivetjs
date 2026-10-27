import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatSource: Stacked Favicons",
  summary: "`ChatSources.Favicons` stacks the source icons (favicon or domain initial) in the trigger.",
  tags: ["chat-source"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".chat-sources__favicons" },
    { click: ".chat-sources__trigger" },
    { attr: [".chat-sources__trigger", "aria-expanded", "true"] },
    { expect: [".chat-sources__list", "Browser support"] },
  ],
});
