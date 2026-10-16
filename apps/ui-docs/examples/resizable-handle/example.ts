import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Handle",
  summary: "`withHandle` shows a grip on the separator line.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#handle [data-slot=resizable-handle-grip] svg" }, { press: ["#handle", "Home"] }, { attr: ["#handle", "aria-valuenow", "0"] }],
});
