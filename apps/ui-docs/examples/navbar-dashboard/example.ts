import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Dashboard",
  summary: "An app header: brand, sections, notifications and an avatar.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[aria-label=App]" }, { matches: "nav .avatar" }],
});
