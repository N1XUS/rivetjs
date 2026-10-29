import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Custom Image Component",
  summary: 'Avatar demo "Custom Image Component": `Avatar.Image` `render` with a custom responsive image component.',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar img.avatar__image[srcset][alt='John Doe']" }],
});
