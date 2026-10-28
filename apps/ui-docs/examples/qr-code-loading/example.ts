import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "QRCode: Loading",
  summary: "isLoading shows a placeholder symbol with a skeleton sweep until the value is ready.",
  tags: ["qr-code"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#invite-qr[data-loading][aria-busy=true]" },
    { click: "#invite-generate" },
    { absent: "#invite-qr[data-loading]" },
    { attr: ["#invite-qr", "aria-label", "Team invite link"] },
  ],
});
