import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar driven by a signal",
  summary: "An accessor value updates aria-valuenow, the text and the fill in place; the Label inside names the progress bar.",
  tags: ["progress-bar", "render-props"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#upload", "role", "progressbar"] },
    { attr: ["#upload", "aria-valuenow", "20"] },
    { name: ["#upload", "Uploading photos"] },
    { click: "#step" },
    { attr: ["#upload", "aria-valuenow", "40"] },
    { expect: ["#upload-text", "40%"] },
    { matches: "#upload-fill[style*=\"40%\"]" },
    { click: "#reset" },
    { attr: ["#upload", "aria-valuetext", "0%"] },
  ],
});
