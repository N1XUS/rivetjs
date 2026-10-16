import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup actions",
  summary: "onAction on the TagGroup (and on one Tag): a click or Enter performs the tag's action; without selectionMode nothing is selected.",
  tags: ["tag-group", "actions", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#genres [data-key=rock]", "aria-selected", null] },
    { click: "#genres [data-key=jazz]" },
    { expect: ["#genres-value", "Last action: jazz"] },
    { key: "ArrowRight" },
    { focused: "#genres [data-key=pop]" },
    { key: "Enter" },
    { expect: ["#genres-value", "Last action: pop"] },
    { key: "ArrowRight" },
    { key: "Enter" },
    { expect: ["#genres-value", "classical"] },
  ],
});
