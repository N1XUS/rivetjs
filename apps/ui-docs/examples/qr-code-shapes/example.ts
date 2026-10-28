import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Shapes",
  summary: "Square (standard), dots (round modules, rounded eyes) and rounded (connected modules).",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#shape-square.qr-code--square" }, { matches: "#shape-dots.qr-code--dots" }, { matches: "#shape-rounded.qr-code--rounded" }],
});
