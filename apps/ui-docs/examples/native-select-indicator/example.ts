import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Indicator",
  summary:
    "The default chevron is the same morph icon; a native select exposes no open state, so it folds up only where the browser matches select:open. Size and stroke hooks.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=native-select-default-indicator].morph-chevron" }],
});
