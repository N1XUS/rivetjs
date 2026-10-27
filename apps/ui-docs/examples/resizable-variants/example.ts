import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Variants",
  summary: "`variant` colours the handle with the separator token that matches its surface: `primary`, `secondary` or `tertiary`.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 340, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#secondary-handle.resizable__handle--secondary" },
    { matches: "#tertiary-handle.resizable__handle--tertiary" },
    { press: ["#tertiary-handle", "End"] },
    { attr: ["#tertiary-handle", "aria-valuenow", "100"] },
  ],
});
