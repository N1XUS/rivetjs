import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: On Complete",
  summary: 'InputOTP demo "On Complete".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["button[type=submit]", "data-disabled", "true"] },
    { fill: ["input[data-slot=input-otp]", "123456"] },
    { absent: "button[type=submit][data-disabled]" },
  ],
});
