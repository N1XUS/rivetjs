import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: With Pattern",
  summary: 'InputOTP demo "With Pattern".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["input[data-slot=input-otp]", "pattern", "^[a-zA-Z]+$"] },
    { fill: ["input[data-slot=input-otp]", "ab"] },
    { attr: ["[data-slot=input-otp-slot]:nth-of-type(2)", "data-filled", "true"] },
  ],
});
