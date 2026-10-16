import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Controlled",
  summary: 'InputOTP demo "Controlled".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["input[data-slot=input-otp]", "1234"] },
    { expect: ["[data-slot=description]", "1234 (4/6)"] },
    { click: "[data-slot=description] button" },
    { expect: ["[data-slot=description]", "Enter a 6-digit code"] },
  ],
});
