import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Range slider with formatted values",
  summary: "Two SliderThumbs over an array value; formatOptions formats the output and each thumb's aria-valuetext; thumbs cannot cross.",
  tags: ["slider", "range", "format", "tailwind"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#price output", "$200 – $600"] },
    { attr: ["#price input[aria-label=Minimum]", "aria-valuetext", "$200"] },
    { press: ["#price input[aria-label=Minimum]", "PageUp"] },
    { expect: ["#price output", "$300 – $600"] },
    { press: ["#price input[aria-label=Maximum]", "End"] },
    { expect: ["#price output", "$300 – $1,000"] },
  ],
});
