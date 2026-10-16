import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: Controlled",
  summary:
    "value={signal}: the position is a two-way Signal; the readout follows drags and keys, and the preset buttons move the divider (keys and presses settle through the house motion).",
  tags: ["compare", "controlled", "signal"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#compare-controlled-value", "Position: 30%"] },
    { click: "#compare-controlled-75" },
    { attr: ["#compare-controlled-handle", "aria-valuenow", "75"] },
    { expect: ["#compare-controlled-value", "Position: 75%"] },
    { press: ["#compare-controlled-handle", "ArrowLeft"] },
    { expect: ["#compare-controlled-value", "Position: 74%"] },
    { expect: ["#compare-controlled-ends", "Released: 1×"] },
  ],
});
