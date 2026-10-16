import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "controllable()",
  summary: "The controlled / uncontrolled pattern of every cdk component: the caller's signal when given, else internal state from defaultValue.",
  tags: ["cdk", "utils", "controlled"],
  status: "experimental",
  frame: { height: 202, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#free", "5"] },
    { click: "#free-plus" },
    { expect: ["#free", "6"] },
    { expect: ["#parent", "quantity = 2, changed 0 times"] },
    { click: "#owned-plus" },
    { expect: ["#owned", "3"] },
    { expect: ["#parent", "quantity = 3, changed 1 times"] },
    { click: "#clear" },
    { expect: ["#owned", "0"] },
    { expect: ["#parent", "changed 2 times"] },
    { expect: ["#free", "6"] },
  ],
});
