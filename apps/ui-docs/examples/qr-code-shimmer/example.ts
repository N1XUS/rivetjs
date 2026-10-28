import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Shimmer",
  summary: "A decorative light sweep over the finished code; it stops under prefers-reduced-motion.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#promo-qr.qr-code--shimmer:not([data-loading])" }],
});
