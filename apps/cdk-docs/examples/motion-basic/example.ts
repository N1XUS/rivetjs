import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion1D: embla's motion on any value",
  summary: "@rivetjs/cdk/motion animates one number with embla's fixed-step scroll body: the knob eases to the clicked stop; the caller applies the transform.",
  tags: ["motion", "animation", "tailwind"],
  status: "experimental",
  frame: { height: 114, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ click: "#to-end" }, { attr: ["#knob", "data-settled", "272"] }, { click: "#to-middle" }, { attr: ["#knob", "data-settled", "136"] }],
});
