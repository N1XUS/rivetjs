import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: Custom Handle",
  summary:
    "Compare.Handle children replace the default divider and thumb: an accent line with a pill grip and its own lucide icon; dragAnywhere moves the divider to any press on the frame.",
  tags: ["compare", "image", "custom"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#compare-custom-handle .compare__divider" },
    { matches: "#compare-custom-handle svg" },
    { press: ["#compare-custom-handle", "End"] },
    { attr: ["#compare-custom-handle", "aria-valuenow", "100"] },
    { press: ["#compare-custom-handle", "Shift+ArrowLeft"] },
    { attr: ["#compare-custom-handle", "aria-valuenow", "90"] },
  ],
});
