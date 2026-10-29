import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Token Input",
  summary: "Mentions as tokens: @ opens teammates filtered by the query at the caret, Enter inserts one, Backspace removes it whole.",
  tags: ["prompt-input", "ai"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#token-text", "Ask @be"] },
    { matches: "[role=listbox]:not([hidden]) [role=option][data-focused]" },
    { expect: ["[role=listbox]:not([hidden])", "Ben Okafor"] },
    { press: ["#token-text", "Enter"] },
    { expect: [".prompt-input__token", "@ben"] },
    { press: ["#token-text", "Backspace"] },
    { press: ["#token-text", "Backspace"] },
    { absent: ".prompt-input__token" },
    { fill: ["#token-text", "Ping @an"] },
    { press: ["#token-text", "Enter"] },
    { press: ["#token-text", "Enter"] },
    { expect: ["#token-sent", "Sent: Ping @ana"] },
  ],
});
