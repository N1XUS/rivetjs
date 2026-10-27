import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Status: Pulse",
  summary: "A pulsing ring for live states (recording, deploying); the ring stops under prefers-reduced-motion.",
  tags: ["status"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#deploy-status [data-slot=status].status--pulse[role=img][aria-label='Deploying']" }, { expect: ["#deploy-status", "Production"] }],
});
