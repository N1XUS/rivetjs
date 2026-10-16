import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider with a label, output and fill",
  summary: "A Slider bound to a signal: Label, SliderOutput, and a SliderTrack holding a SliderFill and a SliderThumb; arrow and Page keys step the value.",
  tags: ["slider", "tailwind", "signals"],
  status: "experimental",
  frame: { height: 100, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#volume input", "type", "range"] },
    { attr: ["#volume input", "aria-valuetext", "30"] },
    { expect: ["#volume output", "30"] },
    { name: ["#volume [role=group]", "Volume"] },
    { press: ["#volume input", "ArrowRight"] },
    { expect: ["#volume output", "31"] },
    { press: ["#volume input", "PageUp"] },
    { expect: ["#volume-value", "41"] },
  ],
});
