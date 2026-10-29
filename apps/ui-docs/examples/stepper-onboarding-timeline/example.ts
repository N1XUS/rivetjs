import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Onboarding Timeline",
  summary: "A vertical onboarding checklist: the current step shows its action button; completing it moves the timeline on.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "lg",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#stepper-onboarding-timeline-state", "1 of 4 done"],
    },
    {
      expect: ["#stepper-onboarding-timeline-action", "I verified it"],
    },
    {
      click: "#stepper-onboarding-timeline-action",
    },
    {
      expect: ["#stepper-onboarding-timeline-state", "2 of 4 done"],
    },
    {
      attr: ['#stepper-onboarding-timeline [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
    {
      expect: ["#stepper-onboarding-timeline-action", "Send invites"],
    },
  ],
});
