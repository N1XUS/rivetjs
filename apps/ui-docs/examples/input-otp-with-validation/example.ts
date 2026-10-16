import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: With Validation",
  summary: 'InputOTP demo "With Validation".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["input[data-slot=input-otp]", "111111"] },
    { click: "button[type=submit]" },
    { attr: ["input[data-slot=input-otp]", "data-invalid", "true"] },
    { attr: ["#code-error", "data-visible", "true"] },
  ],
});
