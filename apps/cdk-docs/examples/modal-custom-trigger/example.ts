import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal with a custom trigger",
  summary: 'DialogTrigger with a Pressable child: a span with role=button opens the modal; Button slot="close" closes it and focus returns to the span.',
  tags: ["modal", "pressable", "custom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#mct-trigger", "aria-expanded", "false"] },
    { click: "#mct-trigger" },
    { matches: "#mct[role=dialog]" },
    { name: ["#mct", "Dialog"] },
    { click: "#mct-close" },
    { absent: "#mct" },
    { focused: "#mct-trigger" },
  ],
});
