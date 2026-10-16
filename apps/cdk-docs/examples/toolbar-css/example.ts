import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar with plain CSS",
  summary: "A plain stylesheet for .rv-Toolbar and its [data-orientation], with separators and the buttons inside styled by their own classes.",
  tags: ["toolbar", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [{ matches: ".rv-Toolbar[data-orientation='horizontal']#css-tools" }, { press: ["#css-cut", "ArrowRight"] }, { focused: "#css-copy" }],
});
