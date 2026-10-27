import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Backdrop Variants",
  summary: "variant on the backdrop: opaque (default), blur or transparent.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-backdrop-blur",
    },
    {
      matches: ".command__backdrop--blur",
    },
  ],
});
