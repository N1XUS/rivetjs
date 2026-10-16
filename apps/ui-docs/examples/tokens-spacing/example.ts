import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: spacing and density",
  summary:
    "The 4-pt spacing scale (--space-1 … --space-8) as rulers, and the same small form in compact, default and comfortable density with the measured control heights. Values are read from the live CSS.",
  tags: ["tokens", "spacing", "density", "theme"],
  status: "experimental",
  frame: { height: 560, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-value='--space-1']", "4px"] },
    { expect: ["[data-value='--space-8']", "52px"] },
    { expect: ["[data-value='compact-button']", "32px"] },
    { expect: ["[data-value='default-button']", "36px"] },
  ],
});
