import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: fractional read-only",
  summary: "Read-only values fill stars partly (4.3, 2.75).",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-fraction [role=img][aria-label='4.3 out of 5']",
    },
  ],
});
