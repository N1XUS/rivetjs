import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Custom Image Component",
  summary: 'Avatar demo "Custom Image Component"; partly not yet ported (see the note in the code).',
  tags: ["avatar", "not-yet-ported"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
