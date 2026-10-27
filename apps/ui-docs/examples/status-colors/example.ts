import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Status: Colors",
  summary: "The five semantic colours, each named next to its dot (the dots stay aria-hidden).",
  tags: ["status"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#status-colors [data-slot=status].status--success[aria-hidden=true]" }, { expect: ["#status-colors li:nth-child(5)", "Danger"] }],
});
