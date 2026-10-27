import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Persisted layout",
  summary:
    "`useDefaultLayout` with `cookieStorage(request cookie header)` saves the layout to a cookie and renders the saved sizes on the server, so a reload never shifts.",
  tags: ["resizable", "cookies"],
  status: "experimental",
  mode: "server",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#shell-handle", "aria-valuenow", null] }, { press: ["#shell-handle", "ArrowRight"] }, { attr: ["#shell-handle", "aria-valuenow", "35"] }],
});
