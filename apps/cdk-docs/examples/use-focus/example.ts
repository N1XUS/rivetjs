import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "focusProps and focusWithinProps",
  summary: "focusProps reports focus of the element itself only; focusWithinProps reports a group gaining and losing focus, not moves inside it.",
  tags: ["cdk", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#email" },
    { expect: ["#self", "email:focus"] },
    { expect: ["#within", "group:in"] },
    // Moving inside the group: one blur of the field, no group events.
    { click: "#phone" },
    { expect: ["#self", "email:focus email:blur"] },
    { expect: ["#within", "group:in"] },
    { click: "#outside" },
    { expect: ["#within", "group:in group:out"] },
    { expect: ["#state", "group focused: false"] },
  ],
});
