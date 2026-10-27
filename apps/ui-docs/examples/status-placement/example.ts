import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Status: Placement",
  summary: "A presence dot on an Avatar corner (named with aria-label), and a dot inside a Chip next to its text.",
  tags: ["status", "avatar", "chip"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#presence-ada [data-slot=status][role=img][aria-label=Online]" },
    { matches: "#order-chip [data-slot=status][aria-hidden=true]" },
    { expect: ["#order-chip", "Pending"] },
  ],
});
