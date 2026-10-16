import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Component props",
  summary: "A Badge component gets a plain label and a signal. Only the number that reads the signal updates.",
  tags: ["components", "signals"],
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/components/Badge.tsx"],
  test: [
    { expect: ["#badge-messages", "0"] },
    { expect: ["#badge-alerts", "3"] },
    { click: "#inc" },
    { expect: ["#badge-messages", "1"] },
    { click: "#inc" },
    { expect: ["#badge-messages", "2"] },
    { click: "#inc" },
    { expect: ["#badge-messages", "3"] },
  ],
});
