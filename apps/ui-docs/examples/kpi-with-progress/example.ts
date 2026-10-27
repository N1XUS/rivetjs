import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: with progress",
  summary: "A progress bar under the value, coloured by status.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-progress [role=progressbar][aria-valuenow='91']",
    },
  ],
});
