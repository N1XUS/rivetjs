import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Settings",
  summary:
    "Account settings in tabs: a validated profile form with a live character count, notification switches with a frequency Segment, theme cards, two-step sign-in and a close-the-shop confirmation.",
  tags: ["showcase", "tabs", "form", "switch", "radio-button-group", "alert-dialog", "input-group"],
  status: "experimental",
  frame: { height: 860 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#profile-handle", "Field Note"] },
    { click: "#save-profile" },
    { expect: ["#profile-form", "3 to 24 lowercase letters"] },
    { fill: ["#profile-handle", "fieldnote-goods"] },
    { click: "#save-profile" },
    { expect: ["#profile-status", "Saved at"] },
    { click: "[role=tab][data-key=notifications]" },
    { expect: ["#notify-summary", "2 of 4 on"] },
    { click: "[data-slot=switch-content]:has(#notify-reviews)" },
    { expect: ["#notify-summary", "3 of 4 on"] },
    { click: "[role=tab][data-key=account]" },
    { click: "#close-shop" },
    { click: "#confirm-close" },
    { expect: ["#closed-status", "The shop is offline"] },
  ],
});
