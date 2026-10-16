import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link with plain CSS",
  summary: "A plain stylesheet for .rv-Link: :hover, :focus-visible, [data-current], [data-disabled] and [data-pressed].",
  tags: ["link", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [{ matches: "a.rv-Link[data-current]#css-l-now" }, { matches: "span.rv-Link[data-disabled]" }],
});
