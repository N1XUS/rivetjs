import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: disabled",
  summary: "A disabled rating shows its value and takes no input.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-disabled input:disabled",
    },
  ],
});
