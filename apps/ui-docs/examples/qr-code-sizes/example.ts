import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Sizes",
  summary: "sm, md and lg, or a side in pixels.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#size-sm.qr-code--sm" }, { matches: "#size-lg.qr-code--lg" }, { matches: "#size-px[style*='--qr-code-size']" }],
});
