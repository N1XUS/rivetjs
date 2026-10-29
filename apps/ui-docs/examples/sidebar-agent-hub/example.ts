import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: agent hub",
  summary: "A compact AI agent sidebar: new chat and search, workspaces with chips, recent chats with hover actions and a user dropdown; collapses to icons.",
  tags: ["sidebar", "navigation", "dropdown", "ai"],
  status: "experimental",
  frame: { height: 520, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#sah-churn", "aria-current", "page"] },
    { expect: ["#sah-chip-support", "12"] },
    { click: "#sah-benchmarks" },
    { attr: ["#sah-benchmarks", "aria-current", "page"] },
    { expect: ["#sah-title", "Compare vector database benchmarks"] },
    { click: "#sah-new" },
    { expect: ["#sah-title", "New chat"] },
    { click: "#sah-user" },
    { matches: "[role=menu][aria-label=Account]" },
    { key: "Escape" },
    { absent: "[role=menu]" },
    { click: "#sah-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "icon"] },
    { hover: "#sah-new" },
    { expect: ["[role=tooltip]", "New chat"] },
  ],
});
