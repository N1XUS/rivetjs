import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: vertical, plain CSS",
  summary:
    'orientation="vertical" with any content in the layers, styled with plain CSS on the default rv-* classes and data attributes; ArrowDown moves the divider down.',
  tags: ["compare", "slider", "orientation", "css"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#plans .rv-CompareHandle", "aria-orientation", "vertical"] },
    { attr: ["#plans .rv-CompareHandle", "aria-valuenow", "40"] },
    { press: ["#plans .rv-CompareHandle", "ArrowDown"] },
    { attr: ["#plans .rv-CompareHandle", "aria-valuenow", "41"] },
    { press: ["#plans .rv-CompareHandle", "PageUp"] },
    { attr: ["#plans .rv-CompareHandle", "aria-valuenow", "31"] },
    { matches: '#plans .rv-CompareAfter[style*="clip-path"]' },
  ],
});
