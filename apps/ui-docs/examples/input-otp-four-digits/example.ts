import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Four Digits",
  summary: 'InputOTP demo "Four Digits".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input[data-slot=input-otp]", "maxlength", "4"] }],
});
