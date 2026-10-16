import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form submit and reset",
  summary: "Form onSubmit (only once the form is valid) and onReset; a reset restores every field's default value and clears its validation.",
  tags: ["form", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#profile", "class", "rv-Form"] },
    { fill: ["#pf-name", "Grace"] },
    { click: "#pf-save" },
    { expect: ["#pf-log", "submit:name=Grace,news=off"] },
    { click: "label:has(#pf-news)" },
    { expect: ["#pf-state", "Grace / news on"] },
    { click: "#pf-reset" },
    { expect: ["#pf-log", "reset"] },
    { expect: ["#pf-state", "Ada / news off"] },
  ],
});
