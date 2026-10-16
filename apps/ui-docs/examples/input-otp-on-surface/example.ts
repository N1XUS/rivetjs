import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: In Surface",
  summary: 'InputOTP demo "In Surface".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] [data-slot=input-otp-slot]" }],
});
