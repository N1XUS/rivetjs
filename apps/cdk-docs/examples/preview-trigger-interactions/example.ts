import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PreviewTrigger interactions",
  summary:
    "delay (default 600 ms) and closeDelay (default 200 ms) of the warmup / cooldown shared with tooltips; right after one closes the next opens at once; Tab moves into the open preview; isDisabled never opens (hover, focus, long press).",
  tags: ["preview-trigger", "delay", "disabled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // delay={0}: keyboard focus opens it at once.
    { key: "Tab" },
    { focused: "#issue-1234" },
    { matches: "#issue-1234-preview" },
    { expect: ["#issue-1234-preview", "Add PreviewTrigger component"] },
    { key: "Tab" },
    { focused: "#issue-1234-view" },
    { key: "Escape" },
    { absent: "#issue-1234-preview" },
    { focused: "#issue-1234" },
    // Default delay, but warm (a preview just closed): it opens at once.
    { key: "Tab" },
    { focused: "#issue-5678" },
    { matches: "#issue-5678-preview" },
    { attr: ["#issue-5678", "aria-expanded", "true"] },
    // isDisabled: keyboard focus does not open it.
    { key: "Escape" },
    { absent: "#issue-5678-preview" },
    { key: "Tab" },
    { focused: "#issue-9012" },
    { attr: ["#issue-9012", "aria-expanded", "false"] },
    { absent: "#issue-9012-preview" },
  ],
});
