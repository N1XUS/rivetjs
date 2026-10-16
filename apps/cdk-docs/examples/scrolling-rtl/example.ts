import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CdkScrollable: RTL-normalized scrolling",
  summary:
    "CdkScrollable.scrollTo and measureScrollOffset take start / end / left / right / top / bottom and normalize the browser's RTL scrollLeft (getRtlScrollAxisType).",
  tags: ["scrolling", "rtl", "bidi"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#rtl-start-100" },
    // Chromium: scrollLeft is negative in RTL containers.
    { expect: ["#rtl-axis", "NEGATED"] },
    { expect: ["#rtl-offsets", "start 100"] },
    { expect: ["#rtl-offsets", "top 0"] },
    { click: "#rtl-end-0" },
    { expect: ["#rtl-offsets", "end 0"] },
    { expect: ["#rtl-offsets", "left 0"] },
    { click: "#rtl-bottom-0" },
    { expect: ["#rtl-offsets", "bottom 0"] },
    { click: "#rtl-start-0" },
    { expect: ["#rtl-offsets", "start 0,"] },
    { expect: ["#rtl-offsets", "right 0"] },
  ],
});
