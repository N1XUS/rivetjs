import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Colors",
  summary: "Theme foreground, accent, the brand and sunset gradients, and a custom colour through --qr-code-fg.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#color-brand[data-gradient] linearGradient" }, { matches: "#color-sunset[data-gradient]" }, { matches: "#color-accent.qr-code--accent" }],
});
