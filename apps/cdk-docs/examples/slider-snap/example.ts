import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider snap: free drag vs React Aria",
  summary:
    'Two stepped sliders (step 25): the default snap="release" drags freely and animates to the closest step on release; snap="drag" jumps from step to step like React Aria.',
  tags: ["slider", "css", "step", "animation"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#free input", "step", "25"] },
    { attr: ["#stepped input", "step", "25"] },
    { press: ["#free input", "ArrowRight"] },
    { expect: ["#free output", "75"] },
    { press: ["#stepped input", "ArrowLeft"] },
    { expect: ["#stepped output", "25"] },
  ],
});
