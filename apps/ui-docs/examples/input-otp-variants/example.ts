import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Variants",
  summary: 'InputOTP demo "Variants".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".input-otp--secondary" }],
});
