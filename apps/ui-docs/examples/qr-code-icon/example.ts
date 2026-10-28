import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Icon",
  summary: "A centred icon: the modules under it are cleared and the error correction rises to H.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#wifi-qr [data-slot=qr-code-icon] svg" }, { matches: "#pay-qr [data-slot=qr-code-icon]" }, { name: ["#wifi-qr", "Guest Wi-Fi"] }],
});
