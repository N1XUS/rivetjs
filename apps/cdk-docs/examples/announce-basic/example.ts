import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Announcements",
  summary: "announce() writes polite and assertive messages to the server-rendered live regions of <Announcer />.",
  tags: ["cdk", "a11y"],
  status: "experimental",
  frame: { height: 106, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ['[data-rv-announcer="polite"]', "aria-live", "polite"] },
    { attr: ['[data-rv-announcer="assertive"]', "aria-live", "assertive"] },
    {
      attr: [
        '[data-rv-announcer="polite"]',
        "style",
        "border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap",
      ],
    },
    { name: ["#fail", "Simulate an error (announces an alert)"] },
    { press: ["#save", "Enter"] },
    { expect: ['[data-rv-announcer="polite"]', "Draft saved (1)"] },
    { key: "Enter" },
    { expect: ['[data-rv-announcer="polite"]', "Draft saved (2)"] },
    { click: "#fail" },
    { expect: ['[data-rv-announcer="assertive"]', "Could not reach the server"] },
    { expect: ["#heard", "Could not reach the server"] },
  ],
});
