import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 6: pages and layouts",
  summary: "A layout adds navigation around every page. The list moved into its own component; a second page lives at /about.",
  tags: ["tutorial", "routes", "layouts"],
  frame: { height: "lg" },
  show: ["src/routes/_layout.tsx", "src/routes/index.tsx", "src/routes/about.tsx", "src/components/ReadingList.tsx"],
  test: [
    { expect: ["#nav", "About"] },
    { fill: ["#new-title", "Piranesi"] },
    { click: "#add" },
    { expect: ["#summary", "1 of 4 read"] },
  ],
});
