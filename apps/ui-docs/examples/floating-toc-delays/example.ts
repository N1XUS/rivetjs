import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Custom Delays",
  summary: "openDelay and closeDelay (ms) tune the hover timing (defaults 200 / 300).",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [],
});
