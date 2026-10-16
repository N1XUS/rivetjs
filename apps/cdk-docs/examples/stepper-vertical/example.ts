import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: vertical",
  summary: "A vertical stepper: each header (role button, aria-expanded) sits above its panel (role region); arrow keys move between headers.",
  tags: ["cdk", "stepper", "vertical"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#recipe-label-0", "aria-expanded", "true"] },
    { attr: ["#recipe-label-0", "role", "button"] },
    { click: "#recipe-label-1" },
    { attr: ["#recipe-label-1", "aria-current", "step"] },
    { attr: ["#recipe-content-1", "role", "region"] },
    { press: ["#recipe-label-1", "ArrowDown"] },
    { focused: "#recipe-label-2" },
    { key: "Space" },
    { attr: ["#recipe-label-2", "aria-expanded", "true"] },
  ],
});
