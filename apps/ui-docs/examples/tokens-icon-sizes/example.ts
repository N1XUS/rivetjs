import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: icon sizes",
  summary:
    "Icons inside components size themselves from the text next to them (12 / 14 / 16 / 20 px) with an even stroke: the same lucide icon in Tags, Buttons and a large ToggleButton, with its measured size and stroke width.",
  tags: ["tokens", "icons", "button", "tag"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-value='tag-md']", "14px"] }, { expect: ["[data-value='button-md']", "16px"] }, { expect: ["[data-value='button-lg']", "20px"] }],
});
