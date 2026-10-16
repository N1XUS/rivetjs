import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Usage",
  summary: 'InputOTP demo "Usage".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["input[data-slot=input-otp]", "autocomplete", "one-time-code"] },
    { fill: ["input[data-slot=input-otp]", "123"] },
    { attr: ["[data-slot=input-otp-slot]:nth-of-type(3)", "data-filled", "true"] },
  ],
});
