import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Descriptions",
  summary: "Stepper.Description adds a second line under each title.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ['#stepper-descriptions [data-slot="stepper-step"]:nth-child(2) [data-slot="stepper-description"]', "Invite your team"],
    },
  ],
});
