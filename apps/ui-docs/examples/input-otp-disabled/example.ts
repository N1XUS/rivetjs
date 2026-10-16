import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Disabled State",
  summary: 'InputOTP demo "Disabled State".',
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input[data-slot=input-otp]", "disabled", ""] }, { attr: ["[data-slot=input-otp-slot]", "data-disabled", "true"] }],
});
