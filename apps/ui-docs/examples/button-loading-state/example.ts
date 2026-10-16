import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Loading State",
  summary: 'Button demo "Loading State".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=button]", "Upload File"] },
    { click: "[data-slot=button]" },
    { expect: ["[data-slot=button]", "Uploading..."] },
    { matches: "[data-slot=button] [data-slot=spinner]" },
  ],
});
