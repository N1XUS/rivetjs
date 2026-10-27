import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: API access",
  summary: "`onApi` receives the embla API: buttons outside the carousel call `scrollTo`, and `select` events keep them in step.",
  tags: ["carousel", "events"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#cap-status", "Arrival (1 of 5)"] },
    { attr: ["#cap-first", "disabled", ""] },
    { click: "#cap-go-4" },
    { expect: ["#cap-status", "Terrace (4 of 5)"] },
    { click: "#cap-last" },
    { expect: ["#cap-status", "Night (5 of 5)"] },
    { click: "#cap-first" },
    { expect: ["#cap-status", "Arrival (1 of 5)"] },
  ],
});
