import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AriaDescriber",
  summary: "AriaDescriber adds shared, reference-counted aria-describedby messages to elements and removes them again.",
  tags: ["cdk", "a11y", "angular-cdk"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#delete", "aria-describedby", "own-hint"] },
    { click: "#describe" },
    { described: ["#delete", "Cannot be undone"] },
    { described: ["#archive", "Cannot be undone"] },
    // One message element for both, inside the hidden container; the existing id is kept.
    { described: ["#delete", "Removes the file"] },
    { matches: ".cdk-describedby-message-container > [id^=cdk-describedby-message]" },
    { click: "#undescribe" },
    { attr: ["#delete", "aria-describedby", "own-hint"] },
    { attr: ["#archive", "aria-describedby", null] },
    { absent: ".cdk-describedby-message-container" },
  ],
});
