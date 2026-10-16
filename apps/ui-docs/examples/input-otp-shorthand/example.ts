import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputOTP: Shorthand",
  summary: "Rivet addition: no children: one Group with a Slot per `maxLength` position.",
  tags: ["input-otp"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input[data-slot=input-otp]", "12"] }, { attr: ["[data-slot=input-otp-slot]:nth-of-type(2)", "data-filled", "true"] }],
});
