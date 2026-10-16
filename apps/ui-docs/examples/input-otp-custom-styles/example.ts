import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Tailwind CSS",
  summary: 'InputOTP demo "Tailwind CSS".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-otp-slot].rounded-lg" }],
});
