import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Social Buttons",
  summary: "Social sign-in buttons with Google, GitHub and Apple brand logos.",
  tags: ["button"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-slot="button"]:nth-child(1) svg.size-4[aria-hidden="true"]' },
    { matches: '[data-slot="button"]:nth-child(2) svg.size-4[aria-hidden="true"][fill="currentColor"]' },
    { matches: '[data-slot="button"]:nth-child(3) svg.size-4[aria-hidden="true"][fill="currentColor"]' },
  ],
});
