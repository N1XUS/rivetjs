import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Basic",
  summary: "A QR code from a value; editing the link re-encodes it in place.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#share-qr[role=img][aria-label='https://rivetjs.severyn.pro'] svg path.qr-code__body" },
    { fill: ["input", "https://rivetjs.severyn.pro/components/qr-code"] },
    { attr: ["#share-qr", "aria-label", "https://rivetjs.severyn.pro/components/qr-code"] },
  ],
});
