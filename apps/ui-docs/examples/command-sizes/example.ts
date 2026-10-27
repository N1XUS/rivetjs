import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Sizes",
  summary: "size on the container: sm, md (default) and lg set the width and the maximum height.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-size-sm",
    },
    {
      matches: ".command__dialog--sm",
    },
  ],
});
