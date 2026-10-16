import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form is a native form",
  summary: "Form renders a <form> with action, method, encType, target and name; native validation blocks the submit before onSubmit runs.",
  tags: ["form", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#search-form", "action", "/search"] },
    { attr: ["#search-form", "method", "get"] },
    { attr: ["#search-form", "name", "search"] },
    { attr: ["#search-form", "aria-label", "Site search"] },
    // An empty required input blocks the submit: onSubmit does not run.
    { click: "#ns-go" },
    { expect: ["#ns-log", "submits: 0"] },
    { focused: "#ns-q" },
    { fill: ["#ns-q", "rivet"] },
    { click: "#ns-go" },
    { expect: ["#ns-log", "submits: 1 (q=rivet)"] },
  ],
});
