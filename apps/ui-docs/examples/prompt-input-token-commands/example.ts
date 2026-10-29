import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Commands and files",
  summary: "Two triggers in a compact composer docked at the bottom: / picks a command, @ a file; the suggestions open upward (placement top start).",
  tags: ["prompt-input", "ai"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#commands-text", "/tr"] },
    { expect: ["[role=listbox]:not([hidden])", "Translate"] },
    { press: ["#commands-text", "Enter"] },
    { expect: [".prompt-input__token", "/translate"] },
    { fill: ["#commands-text", "/translate @rel"] },
    { expect: ["[role=listbox]:not([hidden])", "release-notes.md"] },
    { press: ["#commands-text", "Escape"] },
    { matches: "[role=listbox][hidden]" },
    { press: ["#commands-text", "Enter"] },
    { expect: ["#commands-sent", "Sent: /translate @rel"] },
  ],
});
