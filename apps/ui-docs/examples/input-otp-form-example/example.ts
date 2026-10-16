import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Form Example",
  summary: 'InputOTP demo "Form Example".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["input[data-slot=input-otp]", "123"] },
    { attr: ["button[type=submit]", "data-disabled", "true"] },
    { fill: ["input[data-slot=input-otp]", "123456"] },
    { absent: "button[type=submit][data-disabled]" },
  ],
});
