import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: persisted layout",
  summary: "useDefaultLayout saves the layout to localStorage after each change and restores it on reload (cookieStorage renders it on the server).",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ press: ["#p-sep", "ArrowLeft"] }, { attr: ["#p-sep", "aria-valuenow", "30"] }],
});
