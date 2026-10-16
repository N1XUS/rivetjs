import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "React Aria live announcer",
  summary:
    "announce() from @rivetjs/cdk/live-announcer: one node per message in role=log regions, assertive by default, aria-labelledby messages, clearAnnouncer.",
  tags: ["cdk", "a11y"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-live-announcer] [aria-live="assertive"]', "role", "log"] },
    { click: "#polite" },
    { expect: ['[data-live-announcer] [aria-live="polite"]', "3 results"] },
    { click: "#assertive" },
    { expect: ['[data-live-announcer] [aria-live="assertive"]', "Upload failed"] },
    { click: "#labelled" },
    { attr: ['[data-live-announcer] [aria-labelledby="status-text"]', "role", "img"] },
    { click: "#clear" },
    { absent: '[data-live-announcer] [aria-live="assertive"] > *' },
    { absent: '[data-live-announcer] [aria-live="polite"] > *' },
  ],
});
