import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Number helpers",
  summary: "clamp, snapValueToStep, roundToStepPrecision and toFixedNumber: the value math behind sliders and number fields.",
  tags: ["cdk", "utils", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#snap", "7.5"] },
    { expect: ["#snap3", "7"] },
    { fill: ["#value", "12"] },
    { expect: ["#clamp", "10"] },
    { expect: ["#snap", "10"] },
    { expect: ["#snap3", "10"] },
    { fill: ["#value", "-3"] },
    { expect: ["#clamp", "0"] },
    { expect: ["#snap", "0"] },
    { fill: ["#value", "0.123456"] },
    { expect: ["#round", "0.123"] },
    { expect: ["#fixed", "0.1"] },
  ],
});
