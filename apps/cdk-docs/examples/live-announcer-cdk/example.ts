import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Angular CDK LiveAnnouncer",
  summary: "LiveAnnouncer.announce with politeness and a clear duration, and CdkAriaLive announcing an element's text whenever it changes.",
  tags: ["cdk", "a11y", "angular-cdk"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#saved" },
    { expect: [".cdk-live-announcer-element", "Saved"] },
    { attr: [".cdk-live-announcer-element", "aria-live", "polite"] },
    { click: "#error" },
    { expect: [".cdk-live-announcer-element", "Connection lost"] },
    { attr: [".cdk-live-announcer-element", "aria-live", "assertive"] },
    { click: "#add" },
    { expect: [".cdk-live-announcer-element", "Cart: 1 item"] },
    { attr: [".cdk-live-announcer-element", "aria-live", "polite"] },
    { click: "#flash" },
    { expect: [".cdk-live-announcer-element", "Copied"] },
    // Cleared after 1 s.
    { matches: ".cdk-live-announcer-element:empty" },
  ],
});
