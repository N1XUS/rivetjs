import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: controlled, drag anywhere",
  summary:
    "value={signal} is two-way: drags and keys write the signal, buttons move the divider; dragAnywhere jumps the divider to a press on the frame; onChangeEnd counts releases.",
  tags: ["compare", "slider", "controlled", "signal"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#split-value", "25%"] },
    { click: "#split-75" },
    { attr: ["#split-handle", "aria-valuenow", "75"] },
    { expect: ["#split-value", "75%"] },
    { press: ["#split-handle", "Shift+ArrowLeft"] },
    { expect: ["#split-value", "65%"] },
    { expect: ["#split-ends", "1"] },
  ],
});
