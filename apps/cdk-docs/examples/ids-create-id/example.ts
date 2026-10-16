import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "createId",
  summary: "A Field component that links its label, input and hint with createId(); a field added in the browser gets an id that cannot collide.",
  tags: ["cdk", "id", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/Field.tsx", "src/routes/index.tsx"],
  test: [
    { name: ['[data-field="email"] input', "Email"] },
    { described: ['[data-field="email"] input', "We never share it."] },
    { name: ['[data-field="nickname"] input', "Nickname"] },
    { described: ['[data-field="nickname"] input', "Shown on your posts."] },
    // Server ids start with "rv"; ids created in the browser start with "rvc".
    { matches: '[data-field="email"] input[id^="rv"]:not([id^="rvc"])' },
    { press: ["#more", "Enter"] },
    { matches: '[data-field="website"] input[id^="rvc"]' },
    { name: ['[data-field="website"] input', "Website"] },
    { described: ['[data-field="website"] input', "Optional."] },
  ],
});
