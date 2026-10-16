import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DOM collection",
  summary:
    "domCollection reads keys, node types by role, typeahead text, disabled and href from server-rendered elements; keyAttrs keeps number keys numbers; hidden ones are left out.",
  tags: ["collections", "resumability"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#read" },
    { expect: ["#nodes li:nth-child(1)", 'today: string section "Today"'] },
    { expect: ["#nodes li:nth-child(2)", '1: number item "Welcome" in today'] },
    { expect: ["#nodes li:nth-child(3)", '2: number item "Archived" in today disabled'] },
    { expect: ["#nodes li:nth-child(4)", 'help: string item "Help centre" href #help'] },
    { absent: "#nodes li:nth-child(5)" },
  ],
});
